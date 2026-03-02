
import unittest
import tempfile
import os
import sys
from unittest.mock import MagicMock, patch, PropertyMock

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestLabelerModes(unittest.TestCase):
    """Tests for the Labeler incremental vs full-sweep logic with mocked dependencies."""

    @patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake",
        "GOOGLE_CLIENT_SECRET": "fake",
        "GOOGLE_REFRESH_TOKEN": "fake",
        "GEMINI_API_KEY": "fake",
    })
    def _create_labeler(self):
        """Helper to create a Labeler with all external deps mocked."""
        with patch('labeler.GmailClient') as MockGmail, \
             patch('labeler.GeminiClient') as MockGemini, \
             patch('labeler.StateDB') as MockState:
            
            from labeler import Labeler
            labeler = Labeler(trigger="test")
            
            # Setup mock returns
            labeler.gmail = MockGmail.return_value
            labeler.gemini = MockGemini.return_value
            labeler.state = MockState.return_value
            
            return labeler

    @patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake",
        "GOOGLE_CLIENT_SECRET": "fake",
        "GOOGLE_REFRESH_TOKEN": "fake",
        "GEMINI_API_KEY": "fake",
    })
    def test_incremental_no_history_falls_back(self):
        """If no history ID exists, incremental should fall back to full sweep."""
        labeler = self._create_labeler()
        labeler.state.get_last_history_id.return_value = None
        labeler.gmail.fetch_recent_threads.return_value = []
        labeler.gmail.get_current_history_id.return_value = "99999"
        
        result = labeler.run_incremental(dry_run=True)
        
        # Should have called fetch_recent_threads (full sweep fallback)
        labeler.gmail.fetch_recent_threads.assert_called()

    @patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake",
        "GOOGLE_CLIENT_SECRET": "fake",
        "GOOGLE_REFRESH_TOKEN": "fake",
        "GEMINI_API_KEY": "fake",
    })
    def test_incremental_no_changes(self):
        """If history shows no changes, should skip everything."""
        labeler = self._create_labeler()
        labeler.state.get_last_history_id.return_value = "1000"
        labeler.gmail.fetch_changed_threads_since.return_value = []
        labeler.gmail.get_current_history_id.return_value = "1001"
        
        result = labeler.run_incremental(dry_run=True)
        
        self.assertEqual(result.get("threads_scanned"), 0)
        # Should NOT call get_thread_details (nothing to process)
        labeler.gmail.get_thread_details.assert_not_called()

    @patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake",
        "GOOGLE_CLIENT_SECRET": "fake",
        "GOOGLE_REFRESH_TOKEN": "fake",
        "GEMINI_API_KEY": "fake",
    })
    def test_full_sweep_skips_unchanged(self):
        """Full sweep should skip threads with same message count."""
        labeler = self._create_labeler()
        labeler.gmail.fetch_recent_threads.return_value = [{"id": "t1"}]
        labeler.gmail.get_current_history_id.return_value = "99999"
        
        # Thread has 3 messages, cache says 3 → skip
        labeler.state.get_thread_state.return_value = {
            "thread_id": "t1",
            "message_count": 3,
            "applied_labels": ["STATUS/Processed"],
            "last_processed_at": "2026-01-01",
            "history_id": "1000"
        }
        labeler.gmail.get_thread_details.return_value = {
            "messages": [{"labelIds": []}, {"labelIds": []}, {"labelIds": []}]
        }
        
        result = labeler.run_full_sweep(dry_run=True)
        
        self.assertEqual(result.get("threads_skipped"), 1)
        # Should NOT call gemini (thread was skipped)
        labeler.gemini.classify_thread.assert_not_called()

    @patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake",
        "GOOGLE_CLIENT_SECRET": "fake",
        "GOOGLE_REFRESH_TOKEN": "fake",
        "GEMINI_API_KEY": "fake",
    })
    def test_dry_run_does_not_modify(self):
        """Dry run should NOT call modify_thread_labels."""
        labeler = self._create_labeler()
        labeler.gmail.fetch_recent_threads.return_value = [{"id": "t1"}]
        labeler.gmail.get_current_history_id.return_value = "99999"
        labeler.state.get_thread_state.return_value = None  # New thread
        labeler.gmail.get_thread_details.return_value = {
            "messages": [{
                "labelIds": [],
                "snippet": "Hello, I have a question about my order",
                "payload": {
                    "headers": [
                        {"name": "From", "value": "customer@example.com"},
                        {"name": "Date", "value": "2026-03-01"},
                        {"name": "Subject", "value": "Order Question"},
                    ]
                }
            }]
        }
        labeler.gmail.get_label_map.return_value = {}
        labeler.gemini.classify_thread.return_value = {
            "status": "New",
            "type": "Order",
            "finance": None,
            "action": "Prepare-reply",
            "priority": "Normal",
            "reason": "Customer asking about their order"
        }
        
        result = labeler.run_full_sweep(dry_run=True)
        
        # Should NOT call modify_thread_labels
        labeler.gmail.modify_thread_labels.assert_not_called()
        # But should still report as modified
        self.assertEqual(result.get("threads_modified"), 1)


if __name__ == '__main__':
    unittest.main()
