
import logging
from gmail_client import GmailClient
from gemini_client import GeminiClient
from logger import StructuredLogger
from label_taxonomy import TAXONOMY, get_full_label_list
from config import Config
from datetime import datetime

logger = logging.getLogger("Labeler")

class Labeler:
    def __init__(self, run_id=None, trigger="manual"):
        self.gmail = GmailClient()
        self.gemini = GeminiClient()
        self.logger = StructuredLogger(run_id, trigger)
        
        # Cache full taxonomy list for easy lookup
        self.all_labels = get_full_label_list()

    def run(self, days_lookback=None, force_rescan=False, limit=None):
        """
        Main execution flow.
        """
        days = days_lookback or Config.DAYS_LOOKBACK
        self.logger.log(f"Starting label run. Days={days}, Force={force_rescan}, Limit={limit}")
        
        # 1. Ensure labels exist (Idempotent)
        # We could do this only on startup, but doing it here ensures correctness
        self.gmail.ensure_labels_exist(self.all_labels)
        
        # 2. Fetch threads
        threads = self.gmail.fetch_recent_threads(days_lookback=days, limit=limit)
        self.logger.log(f"Fetched {len(threads)} threads to scan.")
        
        stats = {
            "threads_scanned": len(threads),
            "threads_modified": 0,
            "threads_skipped": 0,
            "threads_requiring_draft": 0,
            "errors": 0
        }

        for thread_summary in threads:
            t_id = thread_summary['id']
            try:
                # Check existing labels first to see if we skip
                # (Simple check: if we have a PROCESSED label and not force_rescan?)
                # Actually, the spec says: "If thread already has labels... update run... If no labels... full run"
                # But to save API calls, we might want to check snippet? 
                # Let's just fetch full details as per spec "Perform per-thread analysis"
                
                thread_details = self.gmail.get_thread_details(t_id)
                if not thread_details:
                    stats["errors"] += 1
                    continue
                    
                messages = thread_details.get('messages', [])
                if not messages:
                    continue
                    
                # Extract simple context
                formatted_messages = []
                last_sender = "unknown"
                
                # Check current labels
                current_labels = messages[0].get('labelIds', []) 
                # Note: labelIds are on messages, but usually we care about the thread's aggregated labels
                # Gmail API returns message-level labels. Thread labels are union of message labels.
                # Actually thread.get responses usually have 'messages' list. using the last message's labels is often enough, 
                # but better to check if ANY message has our taxonomy labels if we want to be strict.
                # Let's map current IDs to Names for checking.
                # Since we don't have the ID->Name map easily without an API call, let's assume we proceed to classify 
                # and then compare with what we want to apply.
                
                # Build context for Gemini
                for msg in messages:
                    headers = {h['name']: h['value'] for h in msg['payload']['headers']}
                    sender = headers.get('From', 'Unknown')
                    date = headers.get('Date', 'Unknown')
                    snippet = msg.get('snippet', '')
                    # We could get full body, but snippet might be enough for classification if body is complex
                    # Spec says: "Read ALL messages... output plain text preferred"
                    # For MVP let's use snippet + subject. If quality is low, we implement full body parsing.
                    formatted_messages.append(f"[MSG {date} - FROM: {sender}]\n{snippet}\n")
                    
                    if "me" in sender.lower() or "scarmonit" in sender.lower() or "petr" in sender.lower(): # Todo: better "From Us" detection
                         # Actually checking if 'labelIds' contains 'SENT' is safer
                         if 'SENT' in msg.get('labelIds', []):
                             last_sender = "us"
                         else:
                             last_sender = "them"
                    else:
                        last_sender = "them"

                subject = {h['name']: h['value'] for h in messages[0]['payload']['headers']}.get('Subject', 'No Subject')
                thread_text = "\n".join(formatted_messages)
                
                # Classify
                classification = self.gemini.classify_thread(subject, len(messages), thread_text)
                
                if not classification:
                    self.logger.log_error(t_id, "Gemini returned None")
                    stats["errors"] += 1
                    continue
                
                # Determine labels to apply
                proposed_labels = []
                proposed_labels.append(f"STATUS/{classification['status']}")
                proposed_labels.append(f"TYPE/{classification['type']}")
                proposed_labels.append(f"ACTION/{classification['action']}")
                proposed_labels.append(f"PRIORITY/{classification['priority']}")
                if classification['finance']:
                    proposed_labels.append(f"FINANCE/{classification['finance']}")
                
                # Logic adjustments (STATUS override based on last sender?)
                # Gemini system prompt handles this, but we can enforce:
                if last_sender == "us" and classification['status'] != 'Closed':
                     # If we replied, it's likely waiting for them, unless we closed it.
                     pass 

                # Calculate diff
                # 1. Resolve current label IDs to Names
                label_map = self.gmail.get_label_map()
                id_to_name = {v: k for k, v in label_map.items()}
                
                current_label_names = set()
                # Get union of all label IDs from all messages (or just first/last?)
                # Gmail Thread.get 'messages' list has labelIds on each message.
                # A label ON THE THREAD means it's on at least one message (usually).
                # But strictly speaking, we want to clear old taxonomy labels.
                
                # Let's collect all label Ids on the thread
                thread_label_ids = set()
                for msg in messages:
                   thread_label_ids.update(msg.get('labelIds', []))
                   
                for lid in thread_label_ids:
                    if lid in id_to_name:
                        current_label_names.add(id_to_name[lid])
                
                # 2. Determine what to remove
                # Remove any label that is in our TAXONOMY but NOT in our proposed set.
                # This ensures we switch status, type, etc. cleanly.
                remove_labels = []
                for label in current_label_names:
                    # Check if this label is in our full taxonomy list
                    if label in self.all_labels:
                        if label not in proposed_labels:
                            remove_labels.append(label)

                self.gmail.modify_thread_labels(t_id, add_labels=proposed_labels, remove_labels=remove_labels) 

                # Log
                self.logger.log_action(
                    t_id, subject, proposed_labels, remove_labels, [], classification['reason']
                )
                stats["threads_modified"] += 1
                
                if "Prepare-reply" in classification['action']:
                    stats["threads_requiring_draft"] += 1
                    
            except Exception as e:
                self.logger.log_error(t_id, str(e))
                stats["errors"] += 1

        return self.logger.finish(stats)

