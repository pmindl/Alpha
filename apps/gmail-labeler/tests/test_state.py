
import unittest
import tempfile
import os
import sys
from datetime import datetime, timedelta

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from state import StateDB


class TestStateDB(unittest.TestCase):
    def setUp(self):
        """Create a temporary DB for each test."""
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test_state.db")
        self.state = StateDB(self.db_path)

    def tearDown(self):
        """Clean up temp files."""
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        if os.path.exists(self.db_path + "-journal"):
            os.remove(self.db_path + "-journal")
        os.rmdir(self.temp_dir)

    # ── History ID ──────────────────────────────

    def test_history_id_none_initially(self):
        self.assertIsNone(self.state.get_last_history_id())

    def test_history_id_set_get(self):
        self.state.set_last_history_id("12345")
        self.assertEqual(self.state.get_last_history_id(), "12345")

    def test_history_id_overwrite(self):
        self.state.set_last_history_id("100")
        self.state.set_last_history_id("200")
        self.assertEqual(self.state.get_last_history_id(), "200")

    # ── Full Sweep ──────────────────────────────

    def test_needs_full_sweep_initially(self):
        self.assertTrue(self.state.needs_full_sweep())

    def test_needs_full_sweep_after_sweep(self):
        self.state.set_last_full_sweep()
        self.assertFalse(self.state.needs_full_sweep(max_hours=24))

    def test_needs_full_sweep_after_expiry(self):
        self.state.set_last_full_sweep()
        # Directly test with 0 hours — should always need sweep
        self.assertTrue(self.state.needs_full_sweep(max_hours=0))

    # ── Thread Cache ────────────────────────────

    def test_thread_state_none_initially(self):
        self.assertIsNone(self.state.get_thread_state("thread_abc"))

    def test_thread_state_set_get(self):
        labels = ["STATUS/New", "TYPE/Order"]
        self.state.update_thread_state("t1", 3, labels, "h100")
        
        result = self.state.get_thread_state("t1")
        self.assertIsNotNone(result)
        self.assertEqual(result["thread_id"], "t1")
        self.assertEqual(result["message_count"], 3)
        self.assertEqual(result["applied_labels"], labels)
        self.assertEqual(result["history_id"], "h100")

    def test_thread_state_update(self):
        self.state.update_thread_state("t1", 2, ["STATUS/New"])
        self.state.update_thread_state("t1", 4, ["STATUS/Closed", "TYPE/Order"])
        
        result = self.state.get_thread_state("t1")
        self.assertEqual(result["message_count"], 4)
        self.assertEqual(result["applied_labels"], ["STATUS/Closed", "TYPE/Order"])

    def test_reset_thread_message_count(self):
        self.state.update_thread_state("t1", 5, ["STATUS/New"])
        self.state.reset_thread_message_count("t1", 0)
        
        result = self.state.get_thread_state("t1")
        self.assertEqual(result["message_count"], 0)
        # Labels should be preserved
        self.assertEqual(result["applied_labels"], ["STATUS/New"])

    # ── Stats ───────────────────────────────────

    def test_stats(self):
        self.state.set_last_history_id("999")
        self.state.update_thread_state("t1", 2, ["STATUS/New"])
        self.state.update_thread_state("t2", 1, ["STATUS/Closed"])
        
        stats = self.state.get_stats()
        self.assertEqual(stats["cached_threads"], 2)
        self.assertEqual(stats["last_history_id"], "999")


if __name__ == '__main__':
    unittest.main()
