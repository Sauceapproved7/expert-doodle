import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import domain_guard_server

class HandlerTests(unittest.TestCase):
    def test_health_is_independent_of_dns(self):
        handler = domain_guard_server.Handler.__new__(domain_guard_server.Handler)
        handler.path = '/health'
        handler.wfile = MagicMock()
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()
        with patch.object(domain_guard_server, 'check', side_effect=AssertionError('must not run')):
            handler.do_GET()
        handler.send_response.assert_called_once_with(200)
        self.assertIn(b'"status": "ok"', handler.wfile.write.call_args.args[0])

if __name__ == '__main__':
    unittest.main()
