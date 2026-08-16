import asyncio
import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import main


class HealthCapabilityTest(unittest.TestCase):
    def test_health_advertises_minimum_rating_first_v2(self):
        payload = asyncio.run(main.health())
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["service"], "fcx-backend")
        self.assertEqual(
            payload["solver_features"]["minimum_rating_first"],
            2,
        )
        self.assertEqual(
            payload["solver_features"]["strict_rating_window"],
            1,
        )
        self.assertEqual(payload["solver_features"]["sbc_activity_stats"], 1)
        self.assertEqual(payload["solver_features"]["natural_diagnostics"], 1)
        self.assertEqual(payload["solver_features"]["offline_activity_sync"], 1)
        self.assertEqual(payload["solver_features"]["ea_completion_snapshot"], 1)
        self.assertEqual(payload["solver_features"]["sbc_stop_alert"], 1)


if __name__ == "__main__":
    unittest.main()
