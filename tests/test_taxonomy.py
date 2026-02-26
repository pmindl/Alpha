
import unittest
import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from label_taxonomy import get_full_label_list, TAXONOMY

class TestTaxonomy(unittest.TestCase):
    def test_taxonomy_structure(self):
        """Verify taxonomy has required keys."""
        required = ["STATUS", "TYPE", "FINANCE", "ACTION", "PRIORITY"]
        for key in required:
            self.assertIn(key, TAXONOMY)
            
    def test_full_list_format(self):
        """Verify fully qualified names."""
        full_list = get_full_label_list()
        self.assertTrue(any(l.startswith("STATUS/") for l in full_list))
        self.assertTrue(any(l.startswith("TYPE/") for l in full_list))
        
    def test_draft_exclusion(self):
        """DRAFT labels should not be in the managed list."""
        full_list = get_full_label_list()
        self.assertFalse(any(l.startswith("DRAFT/") for l in full_list))

if __name__ == '__main__':
    unittest.main()
