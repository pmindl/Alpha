
import logging
from gmail_client import GmailClient
from gemini_client import GeminiClient
from logger import StructuredLogger
from label_taxonomy import TAXONOMY, get_full_label_list
from state import StateDB
from config import Config
from datetime import datetime

logger = logging.getLogger("Labeler")

class Labeler:
    def __init__(self, run_id=None, trigger="manual"):
        self.gmail = GmailClient()
        self.gemini = GeminiClient()
        self.logger = StructuredLogger(run_id, trigger)
        self.state = StateDB(Config.STATE_DB_PATH)
        
        # Cache full taxonomy list for easy lookup
        self.all_labels = get_full_label_list()

    def run(self, days_lookback=None, force_rescan=False, limit=None, dry_run=False):
        """
        Legacy full-sweep entry point. Now delegates to run_full_sweep.
        """
        return self.run_full_sweep(
            days_lookback=days_lookback, 
            force_rescan=force_rescan, 
            limit=limit,
            dry_run=dry_run
        )

    def run_incremental(self, dry_run=False):
        """
        Incremental mode: uses Gmail history.list to find only changed threads.
        Token-efficient — skips unchanged threads, uses minimal update prompts.
        """
        self.logger.log("Starting INCREMENTAL run...")
        
        # 1. Ensure labels exist
        self.gmail.ensure_labels_exist(self.all_labels)
        
        # 2. Get last history ID
        last_hid = self.state.get_last_history_id()
        
        if not last_hid:
            self.logger.log("No history ID found. Falling back to full sweep (14-day window, limit 50).")
            return self.run_full_sweep(days_lookback=Config.DAYS_LOOKBACK, limit=50, dry_run=dry_run)
        
        # 3. Fetch changed thread IDs
        changed_ids = self.gmail.fetch_changed_threads_since(last_hid)
        
        if changed_ids is None:
            # History expired (404) → full sweep
            self.logger.log("History ID expired. Falling back to full sweep.")
            return self.run_full_sweep(days_lookback=Config.DAYS_LOOKBACK, limit=50, dry_run=dry_run)
        
        # 4. Save new history ID immediately
        new_hid = self.gmail.get_current_history_id()
        if new_hid:
            self.state.set_last_history_id(new_hid)
        
        if not changed_ids:
            self.logger.log("No changed threads since last run. Done.")
            return self.logger.finish({
                "threads_scanned": 0,
                "threads_modified": 0,
                "threads_skipped": 0,
                "threads_requiring_draft": 0,
                "errors": 0,
                "mode": "incremental"
            })
        
        self.logger.log(f"Found {len(changed_ids)} changed threads to check.")
        
        stats = {
            "threads_scanned": len(changed_ids),
            "threads_modified": 0,
            "threads_skipped": 0,
            "threads_requiring_draft": 0,
            "errors": 0,
            "total_tokens_spent": 0,
            "total_cost_usd": 0.0,
            "mode": "incremental"
        }
        
        for t_id in changed_ids:
            try:
                self._process_thread(t_id, stats, dry_run=dry_run)
            except Exception as e:
                self.logger.log_error(t_id, str(e))
                stats["errors"] += 1
        
        return self.logger.finish(stats)

    def run_full_sweep(self, days_lookback=None, force_rescan=False, limit=None, dry_run=False):
        """
        Full sweep mode: fetches all threads in date window.
        With "unlabeled only" filtering unless force_rescan is True.
        """
        days = days_lookback or Config.DAYS_LOOKBACK
        self.logger.log(f"Starting FULL SWEEP. Days={days}, Force={force_rescan}, Limit={limit}, DryRun={dry_run}")
        
        # 1. Ensure labels exist
        self.gmail.ensure_labels_exist(self.all_labels)
        
        # 2. Fetch threads
        threads = self.gmail.fetch_recent_threads(days_lookback=days, limit=limit)
        self.logger.log(f"Fetched {len(threads)} threads to scan.")
        
        stats = {
            "threads_scanned": len(threads),
            "threads_modified": 0,
            "threads_skipped": 0,
            "threads_requiring_draft": 0,
            "errors": 0,
            "total_tokens_spent": 0,
            "total_cost_usd": 0.0,
            "mode": "full_sweep"
        }

        for thread_summary in threads:
            t_id = thread_summary['id']
            try:
                # Check cache for skip optimization
                if not force_rescan:
                    cached = self.state.get_thread_state(t_id)
                    if cached:
                        # Thread was processed before — check if new messages arrived
                        thread_details = self.gmail.get_thread_details(t_id)
                        if thread_details:
                            current_msg_count = len(thread_details.get('messages', []))
                            if current_msg_count == cached['message_count']:
                                # No new messages, skip
                                stats["threads_skipped"] += 1
                                continue
                
                self._process_thread(t_id, stats, dry_run=dry_run)
                
            except Exception as e:
                self.logger.log_error(t_id, str(e))
                stats["errors"] += 1

        # Save history ID and sweep timestamp
        new_hid = self.gmail.get_current_history_id()
        if new_hid:
            self.state.set_last_history_id(new_hid)
        self.state.set_last_full_sweep()
        
        return self.logger.finish(stats)

    def _process_thread(self, t_id, stats, dry_run=False):
        """
        Process a single thread — handles both new and update classification.
        """
        thread_details = self.gmail.get_thread_details(t_id)
        if not thread_details:
            stats["errors"] += 1
            return
            
        messages = thread_details.get('messages', [])
        if not messages:
            return
        
        current_msg_count = len(messages)
        
        # Check cached state for this thread
        cached = self.state.get_thread_state(t_id)
        
        # Determine if this is an update or new classification
        is_update = (
            cached is not None 
            and cached['applied_labels'] 
            and current_msg_count > cached['message_count']
        )
        
        # Build context
        formatted_messages = []
        last_sender = "unknown"
        
        for msg in messages:
            headers = {h['name']: h['value'] for h in msg['payload']['headers']}
            sender = headers.get('From', 'Unknown')
            date = headers.get('Date', 'Unknown')
            snippet = msg.get('snippet', '')
            formatted_messages.append(f"[MSG {date} - FROM: {sender}]\n{snippet}\n")
            
            if 'SENT' in msg.get('labelIds', []):
                last_sender = "us"
            else:
                last_sender = "them"

        subject = {h['name']: h['value'] for h in messages[0]['payload']['headers']}.get('Subject', 'No Subject')
        
        # Classify
        if is_update:
            # Only send the new message(s) + existing labels → token efficient
            new_messages = messages[cached['message_count']:]
            new_msg_text = "\n".join(
                msg.get('snippet', '') for msg in new_messages
            )
            self.logger.log(f"UPDATE mode for thread {t_id} ({cached['message_count']} → {current_msg_count} msgs)")
            classification, tokens = self.gemini.classify_thread_update(
                subject, new_msg_text, cached['applied_labels']
            )
        else:
            # Full classification
            thread_text = "\n".join(formatted_messages)
            classification, tokens = self.gemini.classify_thread(subject, len(messages), thread_text)
        
        if not classification:
            self.logger.log_error(t_id, "Gemini returned None")
            stats["errors"] += 1
            return
            
        prompt_tokens = tokens.get("prompt_tokens", 0) if tokens else 0
        completion_tokens = tokens.get("completion_tokens", 0) if tokens else 0
        
        # Calculate cost for Gemini 2.0 Flash: $0.10/1M input, $0.40/1M output
        cost_usd = (prompt_tokens / 1_000_000 * 0.10) + (completion_tokens / 1_000_000 * 0.40)
        
        stats["total_tokens_spent"] += (prompt_tokens + completion_tokens)
        stats["total_cost_usd"] += cost_usd
        
        # Determine labels to apply
        proposed_labels = []
        proposed_labels.append(f"STATUS/{classification['status']}")
        proposed_labels.append(f"TYPE/{classification['type']}")
        proposed_labels.append(f"ACTION/{classification['action']}")
        proposed_labels.append(f"PRIORITY/{classification['priority']}")
        if classification['finance']:
            proposed_labels.append(f"FINANCE/{classification['finance']}")
        
        # Calculate diff — remove old taxonomy labels not in proposed set
        label_map = self.gmail.get_label_map()
        id_to_name = {v: k for k, v in label_map.items()}
        
        thread_label_ids = set()
        for msg in messages:
            thread_label_ids.update(msg.get('labelIds', []))
            
        current_label_names = set()
        for lid in thread_label_ids:
            if lid in id_to_name:
                current_label_names.add(id_to_name[lid])
        
        remove_labels = []
        for label in current_label_names:
            if label in self.all_labels and label not in proposed_labels:
                remove_labels.append(label)

        if dry_run:
            self.logger.log(
                f"[DRY-RUN] Thread {t_id} | Subject: \"{subject[:40]}\" | "
                f"Would ADD: {proposed_labels} | Would REMOVE: {remove_labels} | "
                f"Reason: {classification['reason']}"
            )
        else:
            self.gmail.modify_thread_labels(t_id, add_labels=proposed_labels, remove_labels=remove_labels)

        # Log action
        self.logger.log_action(
            t_id, subject, proposed_labels, remove_labels, [], classification['reason']
        )
        
        # Update state cache
        self.state.update_thread_state(
            t_id, 
            current_msg_count, 
            proposed_labels, 
            prompt_tokens=prompt_tokens, 
            completion_tokens=completion_tokens, 
            cost_usd=cost_usd
        )
        
        stats["threads_modified"] += 1
        
        if "Prepare-reply" in classification['action']:
            stats["threads_requiring_draft"] += 1

    def test_thread_update(self, thread_id, dry_run=True):
        """
        Test mode: force re-check a specific thread by resetting its cached message count.
        Always runs in dry-run mode by default.
        """
        self.logger.log(f"TEST-UPDATE mode for thread {thread_id}")
        self.gmail.ensure_labels_exist(self.all_labels)
        
        # Reset the cached count to force an "update" detection
        cached = self.state.get_thread_state(thread_id)
        if cached:
            self.state.reset_thread_message_count(thread_id, max(0, cached['message_count'] - 1))
        
        stats = {
            "threads_scanned": 1,
            "threads_modified": 0,
            "threads_skipped": 0,
            "threads_requiring_draft": 0,
            "errors": 0,
            "total_tokens_spent": 0,
            "total_cost_usd": 0.0,
            "mode": "test-update"
        }
        
        try:
            self._process_thread(thread_id, stats, dry_run=dry_run)
        except Exception as e:
            self.logger.log_error(thread_id, str(e))
            stats["errors"] += 1
        
        return self.logger.finish(stats)
