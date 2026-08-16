import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import activity_stats


class ActivityStatsTest(unittest.TestCase):
    def test_records_today_totals_per_set_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            now = datetime(2026, 8, 16, 14, 30, tzinfo=timezone.utc)
            challenge = {
                "event_id": "challenge-1",
                "event_type": "challenge_submitted",
                "set_id": "123",
                "set_name": "每日金卡升级",
            }
            first = activity_stats.record_event(challenge, path=path, now=now)
            duplicate = activity_stats.record_event(challenge, path=path, now=now)
            completed = activity_stats.record_event({
                **challenge,
                "event_id": "set-1",
                "event_type": "set_completed",
            }, path=path, now=now)

            self.assertFalse(first["duplicate"])
            self.assertTrue(duplicate["duplicate"])
            self.assertEqual(completed["today_squads_submitted"], 1)
            self.assertEqual(completed["today_sets_completed"], 1)
            self.assertEqual(completed["total_squads_submitted"], 1)
            self.assertEqual(completed["total_sets_completed"], 1)
            self.assertEqual(completed["by_set"][0]["set_name"], "每日金卡升级")
            self.assertEqual(completed["by_set"][0]["total_sets_completed"], 1)

    def test_persists_and_separates_daily_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            yesterday = datetime(2026, 8, 15, 8, tzinfo=timezone.utc)
            today = datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            base = {"event_type": "set_completed", "set_id": 7, "set_name": "重复挑战"}
            activity_stats.record_event({**base, "event_id": "old"}, path=path, now=yesterday)
            activity_stats.record_event({**base, "event_id": "new"}, path=path, now=today)

            snapshot = activity_stats.get_stats(path=path, now=today)
            self.assertEqual(snapshot["today_sets_completed"], 1)
            self.assertEqual(snapshot["total_sets_completed"], 2)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["schema_version"], 3)

    def test_offline_event_keeps_original_day(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            received = datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            result = activity_stats.record_event({
                "event_id": "offline",
                "event_type": "set_completed",
                "set_id": 8,
                "set_name": "离线补传",
                "occurred_at": "2026-08-15T08:00:00+00:00",
            }, path=path, now=received)
            self.assertEqual(result["today_sets_completed"], 1)
            snapshot = activity_stats.get_stats(path=path, now=received)
            self.assertEqual(snapshot["today_sets_completed"], 0)
            self.assertEqual(snapshot["total_sets_completed"], 1)

    def test_merges_ea_account_counts_without_double_counting_snapshots(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            now = datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            base = {
                "captured_at": "2026-08-16T08:00:00+00:00",
                "sets": [
                    {"set_id": "10", "set_name": "iOS 项目", "times_completed": 4},
                    {"set_id": "11", "set_name": "网页项目", "times_completed": 2},
                ],
            }
            first = activity_stats.record_ea_snapshot(base, path=path, now=now)
            same = activity_stats.record_ea_snapshot(base, path=path, now=now)
            increased = activity_stats.record_ea_snapshot({
                **base,
                "sets": [{"set_id": "10", "set_name": "iOS 项目", "times_completed": 5}],
            }, path=path, now=now)
            self.assertEqual(first["ea_visible_sets_completed"], 6)
            self.assertEqual(same["ea_observed_sets_completed"], 0)
            self.assertEqual(increased["ea_visible_sets_completed"], 5)
            self.assertEqual(increased["ea_observed_sets_completed"], 1)
            self.assertEqual(increased["ea_by_set"][0]["times_completed"], 5)

    def test_records_the_daily_count_visible_on_the_web_page(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            now = datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            result = activity_stats.record_ea_snapshot({
                "captured_at": "2026-08-16T08:00:00+00:00",
                "sets": [],
                "web_visible_daily_count": 102,
            }, path=path, now=now)
            self.assertEqual(result["web_visible_daily_sbc_count"], 102)

    def test_ea_counter_detects_a_new_cycle(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            now = datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            activity_stats.record_ea_snapshot({"sets": [{
                "set_id": "10", "set_name": "每日项目", "times_completed": 3, "cycle_id": "day-1"
            }]}, path=path, now=now)
            result = activity_stats.record_ea_snapshot({"sets": [{
                "set_id": "10", "set_name": "每日项目", "times_completed": 1, "cycle_id": "day-2"
            }]}, path=path, now=now)
            self.assertEqual(result["ea_visible_sets_completed"], 1)
            self.assertEqual(result["ea_observed_sets_completed"], 0)

            increased = activity_stats.record_ea_snapshot({"sets": [{
                "set_id": "10", "set_name": "每日项目", "times_completed": 2,
                "cycle_id": "day-2-again"
            }]}, path=path, now=now)
            self.assertEqual(increased["ea_observed_sets_completed"], 1)

    def test_migrates_the_inflated_v2_observed_total_to_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sbc-stats.json"
            path.write_text(json.dumps({
                "schema_version": 2,
                "ea_observed_sets_completed": 3146,
                "ea_by_set": {
                    "1017": {
                        "set_name": "84+ TOTW 升级",
                        "last_value": 181,
                        "observed_total": 1239,
                    }
                },
            }), encoding="utf-8")
            result = activity_stats.get_stats(
                path=path, now=datetime(2026, 8, 16, 8, tzinfo=timezone.utc)
            )
            self.assertEqual(result["ea_observed_sets_completed"], 0)
            self.assertEqual(result["ea_by_set"][0]["observed_total"], 0)

    def test_rejects_unknown_event_type(self):
        with self.assertRaisesRegex(ValueError, "event_type"):
            activity_stats.record_event({
                "event_id": "bad", "event_type": "unknown", "set_id": 1, "set_name": "X"
            })


if __name__ == "__main__":
    unittest.main()
