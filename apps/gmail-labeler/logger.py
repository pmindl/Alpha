
import logging
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

# Setup logs directory
LOG_DIR = Path("logs/runs")

def get_log_paths(run_id, date_str):
    run_dir = LOG_DIR / date_str
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir / f"{run_id}.json", run_dir / f"{run_id}.txt"

class StructuredLogger:
    def __init__(self, run_id=None, trigger="manual"):
        self.run_id = run_id or str(uuid.uuid4())
        self.trigger = trigger
        self.start_time = datetime.now()
        self.date_str = self.start_time.strftime("%Y-%m-%d")
        self.json_path, self.txt_path = get_log_paths(self.run_id, self.date_str)
        
        # Internal state for structured log
        self.log_data = {
            "run_id": self.run_id,
            "triggered_by": self.trigger,
            "started_at": self.start_time.isoformat(),
            "actions_required": [],
            "errors": [],
            "summary": ""
        }

        # Setup python logging to console and text file
        self.logger = logging.getLogger(self.run_id)
        self.logger.setLevel(logging.INFO)
        
        # Clear existing handlers
        self.logger.handlers = []

        # File Handler (Human Readable)
        fh = logging.FileHandler(self.txt_path, encoding='utf-8')
        fh.setFormatter(logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
        self.logger.addHandler(fh)

        # Stream Handler (Console)
        sh = logging.StreamHandler()
        sh.setFormatter(logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
        self.logger.addHandler(sh)
        
        self.log(f"RUN STARTED | run_id={self.run_id} | triggered_by={self.trigger}")

    def log(self, message):
        """Log a human-readable message."""
        self.logger.info(message)

    def log_action(self, thread_id, subject, labels_added, labels_removed, labels_kept, reason):
        """Record a labeling action."""
        action = {
            "thread_id": thread_id,
            "subject": subject,
            "labels_added": labels_added,
            "labels_removed": labels_removed,
            "labels_kept": labels_kept,
            "classification_reason": reason
        }
        self.log_data["actions_required"].append(action)
        
        # Human readable log
        added_str = ",".join(labels_added) if labels_added else "None"
        self.log(f"THREAD | id={thread_id} | subject=\"{subject[:30]}...\" | labels_added={added_str}")

    def log_error(self, thread_id, error, skipped=True):
        """Record an error."""
        err_entry = {
            "thread_id": thread_id,
            "error": str(error),
            "skipped": skipped
        }
        self.log_data["errors"].append(err_entry)
        self.log(f"ERROR | thread={thread_id} | msg={error}")

    def finish(self, summary_stats):
        """Finalize the run and write JSON log."""
        self.end_time = datetime.now()
        duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)
        
        self.log_data.update({
            "finished_at": self.end_time.isoformat(),
            "duration_ms": duration_ms,
            **summary_stats
        })
        
        # Write JSON
        with open(self.json_path, 'w', encoding='utf-8') as f:
            json.dump(self.log_data, f, indent=2)
            
        self.log(f"RUN COMPLETE | duration={duration_ms}ms | summary={self.log_data.get('summary', '')}")
        
        return self.log_data
