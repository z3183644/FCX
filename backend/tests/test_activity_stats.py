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
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["schema_version"], 1)

    def test_rejects_unknown_event_type(self):
        with self.assertRaisesRegex(ValueError, "event_type"):
            activity_stats.record_event({
                "event_id": "bad", "event_type": "unknown", "set_id": 1, "set_name": "X"
            })


if __name__ == "__main__":
    unittest.main()
