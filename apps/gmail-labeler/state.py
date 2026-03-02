"""
State tracking for incremental Gmail sync.
Uses SQLite to persist:
- last_history_id (Gmail's incremental cursor)
- thread processing cache (msg count, applied labels)
"""

import sqlite3
import json
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger("State")

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "data", "labeler_state.db")


class StateDB:
    def __init__(self, db_path=None):
        self.db_path = db_path or DEFAULT_DB_PATH
        # Ensure directory exists
        Path(os.path.dirname(self.db_path)).mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create tables if they don't exist."""
        conn = self._get_conn()
        try:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS sync_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS thread_cache (
                    thread_id TEXT PRIMARY KEY,
                    message_count INTEGER NOT NULL DEFAULT 0,
                    applied_labels TEXT NOT NULL DEFAULT '[]',
                    last_processed_at TEXT NOT NULL,
                    history_id TEXT
                );
            """)
            
            # Simple schema migration for v1 to v2 (adding token/cost tracking)
            cursor = conn.execute("PRAGMA table_info(thread_cache)")
            columns = [row[1] for row in cursor.fetchall()]
            if 'prompt_tokens' not in columns:
                conn.execute("ALTER TABLE thread_cache ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
                conn.execute("ALTER TABLE thread_cache ADD COLUMN completion_tokens INTEGER DEFAULT 0")
                conn.execute("ALTER TABLE thread_cache ADD COLUMN cost_usd REAL DEFAULT 0.0")
                
            conn.commit()
            logger.info(f"State DB initialized at {self.db_path}")
        finally:
            conn.close()

    # ── Sync State ──────────────────────────────────────────────

    def get_last_history_id(self):
        """Get the last processed Gmail historyId, or None if first run."""
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT value FROM sync_state WHERE key = 'last_history_id'"
            ).fetchone()
            return row["value"] if row else None
        finally:
            conn.close()

    def set_last_history_id(self, history_id):
        """Save the current Gmail historyId."""
        now = datetime.now().isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT INTO sync_state (key, value, updated_at) 
                   VALUES ('last_history_id', ?, ?)
                   ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?""",
                (str(history_id), now, str(history_id), now)
            )
            conn.commit()
        finally:
            conn.close()

    def get_last_full_sweep(self):
        """Get timestamp of last full sweep, or None."""
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT value FROM sync_state WHERE key = 'last_full_sweep'"
            ).fetchone()
            if row:
                return datetime.fromisoformat(row["value"])
            return None
        finally:
            conn.close()

    def set_last_full_sweep(self):
        """Record that a full sweep just completed."""
        now = datetime.now().isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT INTO sync_state (key, value, updated_at) 
                   VALUES ('last_full_sweep', ?, ?)
                   ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?""",
                (now, now, now, now)
            )
            conn.commit()
        finally:
            conn.close()

    def needs_full_sweep(self, max_hours=24):
        """Returns True if more than max_hours since last full sweep."""
        last = self.get_last_full_sweep()
        if last is None:
            return True
        return (datetime.now() - last) > timedelta(hours=max_hours)

    # ── Thread Cache ────────────────────────────────────────────

    def get_thread_state(self, thread_id):
        """
        Get cached state for a thread.
        Returns dict with message_count, applied_labels, last_processed_at
        or None if not cached.
        """
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM thread_cache WHERE thread_id = ?",
                (thread_id,)
            ).fetchone()
            if row:
                return {
                    "thread_id": row["thread_id"],
                    "message_count": row["message_count"],
                    "applied_labels": json.loads(row["applied_labels"]),
                    "last_processed_at": row["last_processed_at"],
                    "history_id": row["history_id"],
                }
            return None
        finally:
            conn.close()

    def update_thread_state(self, thread_id, message_count, labels, history_id=None, prompt_tokens=0, completion_tokens=0, cost_usd=0.0):
        """Update or insert thread processing state."""
        now = datetime.now().isoformat()
        labels_json = json.dumps(labels)
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT INTO thread_cache 
                   (thread_id, message_count, applied_labels, last_processed_at, history_id, prompt_tokens, completion_tokens, cost_usd)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(thread_id) DO UPDATE SET 
                       message_count = ?, applied_labels = ?, last_processed_at = ?, history_id = ?,
                       prompt_tokens = prompt_tokens + ?, completion_tokens = completion_tokens + ?, cost_usd = cost_usd + ?""",
                (thread_id, message_count, labels_json, now, history_id, prompt_tokens, completion_tokens, cost_usd,
                 message_count, labels_json, now, history_id, prompt_tokens, completion_tokens, cost_usd)
            )
            conn.commit()
        finally:
            conn.close()

    def reset_thread_message_count(self, thread_id, new_count=0):
        """
        For testing: reset a thread's cached message count to force re-check.
        """
        now = datetime.now().isoformat()
        conn = self._get_conn()
        try:
            conn.execute(
                "UPDATE thread_cache SET message_count = ?, last_processed_at = ? WHERE thread_id = ?",
                (new_count, now, thread_id)
            )
            conn.commit()
            return conn.total_changes > 0
        finally:
            conn.close()

    def get_stats(self):
        """Get summary stats about the state DB."""
        conn = self._get_conn()
        try:
            row = conn.execute("SELECT COUNT(*), SUM(prompt_tokens + completion_tokens), SUM(cost_usd) FROM thread_cache").fetchone()
            thread_count = row[0] or 0
            total_tokens = row[1] or 0
            total_cost = row[2] or 0.0
            
            history_id = self.get_last_history_id()
            last_sweep = self.get_last_full_sweep()
            return {
                "cached_threads": thread_count,
                "total_tokens_used": total_tokens,
                "total_cost_usd": round(total_cost, 4),
                "last_history_id": history_id,
                "last_full_sweep": last_sweep.isoformat() if last_sweep else None,
            }
        finally:
            conn.close()
