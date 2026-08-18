"""Regression test: currentSolution containing empty slots (None) must not crash.

Python 3.14 makes bool(NotImplemented) a TypeError, which broke the old
`filter(None.__ne__, ...)` count in create_var when the current squad had
empty positions. This test goes through runAutoSBC, the same entry point
used by the /solve endpoint.
"""

import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import setup  # noqa: E402


def _player(i, rating=75, team=1, league=1, nation=1, price=200):
    return {
        "id": i,
        "name": f"PLAYER{i}",
        "cardType": "PLAYER",
        "assetId": i,
        "definitionId": i,
        "rating": rating,
        "teamId": team,
        "leagueId": league,
        "nationId": nation,
        "rarityId": 0,
        "ratingTier": 2,
        "isUntradeable": "",
        "isDuplicate": "",
        "preferredPosition": "0",
        "possiblePositions": [0],
        "groups": [1],
        "isFixed": "",
        "concept": False,
        "price": price,
        "futBinPrice": "",
        "futggPrice": price,
    }


class CurrentSolutionNoneTest(unittest.TestCase):
    def test_solve_with_none_slots_in_current_solution(self):
        players = [_player(i) for i in range(15)]
        sbc = {
            "name": "回归测试",
            "constraints": [
                {
                    "scope": "GREATER",
                    "count": 11,
                    "requirementKey": "TEAM_RATING",
                    "eligibilityValues": [60],
                }
            ],
            "brickIndices": [],
            "currentSolution": [None] * 11,
            "formation": [0] * 11,
        }
        try:
            result = setup.runAutoSBC(sbc, players, 5)
        except TypeError as exc:
            self.fail(f"runAutoSBC raised TypeError on None currentSolution: {exc}")
        self.assertIsNotNone(result)


if __name__ == "__main__":
    unittest.main()
