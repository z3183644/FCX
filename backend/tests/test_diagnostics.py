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

    def test_explains_that_web_submission_failed_after_solver_success(self):
        item = diagnostics.humanize("WEB_CLIENT sbc_submission_failed: HTTP 409")
        self.assertEqual(item["title"], "EA 提交失败")
        self.assertIn("成功生成方案", item["message"])
        self.assertIn("HTTP 409", item["suggestion"])

    def test_explains_a_403_as_an_ea_submission_rejection(self):
        item = diagnostics.humanize("WEB_CLIENT sbc_submission_failed: 提交SBC失败（状态 403）")
        self.assertEqual(item["title"], "EA 暂时拒绝了 SBC 提交")
        self.assertIn("刷新 Web App", item["suggestion"])

    def test_returns_the_latest_sbc_stop_as_a_stable_alert(self):
        alert = diagnostics.latest_sbc_stop_alert([
            {"time": 10.5, "message": "WEB_CLIENT sbc_set_stopped: 候选球员不足"},
            {"time": 11.0, "message": "普通日志"},
        ])
        self.assertEqual(alert["title"], "SBC 已停止")
        self.assertEqual(alert["reason"], "候选球员不足")
        self.assertEqual(alert["event_id"], "10.500000:候选球员不足")


if __name__ == "__main__":
    unittest.main()
