import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import domain_guard

class DomainGuardTests(unittest.TestCase):
    @patch('domain_guard.socket.getaddrinfo', side_effect=OSError('unavailable'))
    @patch('domain_guard.urllib.request.urlopen', side_effect=OSError('offline'))
    def test_offline_never_reports_ready(self, url, dns):
        result = domain_guard.check()
        self.assertEqual(result['addresses'], [])
        self.assertFalse(result['https_ok'])
        self.assertIn('dns_error', result)
        self.assertIn('https_error', result)

if __name__ == '__main__':
    unittest.main()
