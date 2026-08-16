import sys
import unittest
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import diagnostics


class DiagnosticsTest(unittest.TestCase):
    def test_translates_common_solver_progress(self):
        item = diagnostics.humanize("Processing 836 players, max time: 60s")
        self.assertEqual(item["title"], "候选球员已载入")
        self.assertIn("836", item["message"])

    def test_translates_requirement_and_provides_suggestion(self):
        item = diagnostics.humanize("Failed requirement: LEAGUE_ID requires 3")
        self.assertEqual(item["title"], "联赛未满足")
        self.assertIn("建议", "建议：" + item["suggestion"])
        self.assertEqual(item["raw"], "Failed requirement: LEAGUE_ID requires 3")

    def test_ignores_configuration_noise(self):
        self.assertIsNone(diagnostics.humanize("challengeId: 12345"))


if __name__ == "__main__":
    unittest.main()
