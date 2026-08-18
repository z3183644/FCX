import os
import math
import time
from threading import Timer

from logger import add_log  # Import the add_log function from globals
from ortools.sat.python import cp_model


SQUAD_RATING_MAX_OVERSHOOT = 0.8


def _round_fraction_half_up(numerator, denominator):
    """Round a non-negative fraction to the nearest integer, halves upward."""
    return (2 * int(numerator) + int(denominator)) // (2 * int(denominator))


def calculate_squad_rating(ratings):
    """Return the EA squad rating, rounded to two decimals without float drift."""
    normalized = [int(rating) for rating in ratings]
    if not normalized:
        return 0.0

    squad_size = len(normalized)
    total_rating = sum(normalized)
    excess_numerator = sum(
        max(rating * squad_size - total_rating, 0) for rating in normalized
    )
    adjusted_numerator = total_rating * squad_size + excess_numerator
    rounded_adjusted_total = _round_fraction_half_up(
        adjusted_numerator, squad_size
    )
    rating_hundredths = _round_fraction_half_up(
        rounded_adjusted_total * 100, squad_size
    )
    return rating_hundredths / 100


def squad_rating_window(target_rating, squad_size, max_overshoot=SQUAD_RATING_MAX_OVERSHOOT):
    """Return inclusive score and rounded-total bounds for a strict rating window."""
    squad_size = int(squad_size)
    if squad_size <= 0:
        raise ValueError("squad_size must be positive")
    max_overshoot = round(float(max_overshoot), 1)
    if not math.isfinite(max_overshoot) or not 0 <= max_overshoot <= 5:
        raise ValueError("max_overshoot must be between 0 and 5")

    minimum_hundredths = int(round(float(target_rating) * 100))
    maximum_hundredths = int(
        round((float(target_rating) + max_overshoot) * 100)
    )
    allowed_totals = [
        rounded_total
        for rounded_total in range(0, 99 * squad_size + 1)
        if minimum_hundredths
        <= _round_fraction_half_up(rounded_total * 100, squad_size)
        <= maximum_hundredths
    ]
    if not allowed_totals:
        raise ValueError("rating window has no representable squad rating")

    return {
        "minimum": minimum_hundredths / 100,
        "maximum": maximum_hundredths / 100,
        "minimum_rounded_total": min(allowed_totals),
        "maximum_rounded_total": max(allowed_totals),
    }


def runtime(func):
    """Wrapper function to log the execution time"""

    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        seconds = round(time.time() - start, 2)
        print(f"Processing time {func.__name__}: {seconds} seconds")
        add_log(f"Processing time {func.__name__}: {seconds} seconds")
        return result

    return wrapper


class SolutionCallback(cp_model.CpSolverSolutionCallback):
    """Stop the search if the objective remains the same for X seconds"""

    def __init__(self, timer_limit: int, player):
        super().__init__()
        self._timer_limit = timer_limit
        self._timer = None
        self._player = player
        self.solutions = []  # Add this to store solutions
        self.solution_count = 0

    def on_solution_callback(self):
        """This is called everytime a solution with better objective is found."""
        self.solution_count += 1
        objective_value = self.ObjectiveValue()

        # Store solution details
        solution_info = {
            "solution_number": self.solution_count,
            "objective_value": objective_value,
            "time": time.time(),
        }

        # Add selected players to solution info
        selected_players = []
        for i in range(len(self._player)):
            if self.Value(self._player[i]) == 1:
                selected_players.append(i)
        solution_info["selected_players"] = selected_players
        print("selected_players", selected_players)
        # Use the shared logging function
        add_log(
            f"Solution {self.solution_count} found with objective value: {objective_value}",
            selected_players,
        )
        self.solutions.append(solution_info)
        self._reset_timer()

    def _reset_timer(self):
        if self._timer:
            self._timer.cancel()
        self._timer = Timer(self._timer_limit, self.StopSearch)
        self._timer.start()

    def StopSearch(self):
        print(f"{self._timer_limit} seconds without improvement in objective. ")
        super().StopSearch()


@runtime
def create_var(model, df, map_idx, num_cnts, sbc):
    """Create the relevant variables"""
    num_players, num_teamIds, num_leagueId, num_nationId, num_ratingTier = (
        num_cnts[0],
        num_cnts[1],
        num_cnts[2],
        num_cnts[3],
        num_cnts[4],
    )

    player = []  # player[i] = 1 => i^th player is considered and 0 otherwise
    chem = []  # chem[i] = chemistry of i^th player

    # Preprocessing things to speed-up model creation time.
    # Thanks Gregory Wullimann !!
    players_grouped = {
        "teamId": {},
        "leagueId": {},
        "nationId": {},
        "possiblePositions": {},
        "rating": {},
        "ratingTier": {},
        "groups": {},
        "rarityId": {},
        "name": {},
    }
    # Try adding hints to solver to enable rerun of solver multiple times and start where you left off
    playerHints = []
    for i in range(num_players):
        boolVar = model.NewBoolVar(f"player{i}")
        player.append(boolVar)
        if sum(1 for x in sbc["currentSolution"] if x is not None) > 0:
            if df.at[i, "assetId"] in sbc["currentSolution"]:
                solutionPosition = sbc["formation"][
                    sbc["currentSolution"].index(df.at[i, "assetId"])
                ]
                key_names = ["assetId", "possiblePositions"]
                keys = [df.at[i, "assetId"], solutionPosition]

                if (
                    df.at[i, "possiblePositions"] == solutionPosition
                    or df[(df[key_names] == keys).all(1)]["name"].count() == 0
                ) and df.at[i, "assetId"] not in playerHints:
                    playerHints.append(df.at[i, "assetId"])
                    model.AddHint(boolVar, 1)
            else:
                model.AddHint(boolVar, 0)
        chem.append(model.NewIntVar(0, 3, f"chem{i}"))
        players_grouped["teamId"][map_idx["teamId"][df.at[i, "teamId"]]] = (
            players_grouped["teamId"].get(map_idx["teamId"][df.at[i, "teamId"]], [])
            + [player[i]]
        )
        players_grouped["leagueId"][map_idx["leagueId"][df.at[i, "leagueId"]]] = (
            players_grouped["leagueId"].get(
                map_idx["leagueId"][df.at[i, "leagueId"]], []
            )
            + [player[i]]
        )
        players_grouped["nationId"][map_idx["nationId"][df.at[i, "nationId"]]] = (
            players_grouped["nationId"].get(
                map_idx["nationId"][df.at[i, "nationId"]], []
            )
            + [player[i]]
        )
        players_grouped["possiblePositions"][
            map_idx["possiblePositions"][df.at[i, "possiblePositions"]]
        ] = players_grouped["possiblePositions"].get(
            map_idx["possiblePositions"][df.at[i, "possiblePositions"]], []
        ) + [player[i]]
        players_grouped["rating"][map_idx["rating"][df.at[i, "rating"]]] = (
            players_grouped["rating"].get(map_idx["rating"][df.at[i, "rating"]], [])
            + [player[i]]
        )
        players_grouped["ratingTier"][map_idx["ratingTier"][df.at[i, "ratingTier"]]] = (
            players_grouped["ratingTier"].get(
                map_idx["ratingTier"][df.at[i, "ratingTier"]], []
            )
            + [player[i]]
        )
        players_grouped["groups"][map_idx["groups"][df.at[i, "groups"]]] = (
            players_grouped["groups"].get(map_idx["groups"][df.at[i, "groups"]], [])
            + [player[i]]
        )
        players_grouped["rarityId"][map_idx["rarityId"][df.at[i, "rarityId"]]] = (
            players_grouped["rarityId"].get(
                map_idx["rarityId"][df.at[i, "rarityId"]], []
            )
            + [player[i]]
        )
        players_grouped["name"][map_idx["name"][df.at[i, "name"]]] = players_grouped[
            "name"
        ].get(map_idx["name"][df.at[i, "name"]], []) + [player[i]]
    # These variables are basically chemistry of each teamId, leagueId and nation
    z_teamId = [model.NewIntVar(0, 3, f"z_teamId{i}") for i in range(num_teamIds)]
    z_leagueId = [model.NewIntVar(0, 3, f"z_leagueId{i}") for i in range(num_leagueId)]
    z_nation = [model.NewIntVar(0, 3, f"z_nation{i}") for i in range(num_nationId)]

    # Needed for chemistry constraint
    b_c = [
        [model.NewBoolVar(f"b_c{j}{i}") for i in range(4)] for j in range(num_teamIds)
    ]
    b_l = [
        [model.NewBoolVar(f"b_l{j}{i}") for i in range(4)] for j in range(num_leagueId)
    ]
    b_n = [
        [model.NewBoolVar(f"b_n{j}{i}") for i in range(4)] for j in range(num_nationId)
    ]

    # These variables represent whether a particular teamId, leagueId or nation is
    # considered in the final solution or not
    teamId = [model.NewBoolVar(f"teamId_{i}") for i in range(num_teamIds)]
    nationId = [model.NewBoolVar(f"nationId_{i}") for i in range(num_nationId)]
    leagueId = [model.NewBoolVar(f"leagueId_{i}") for i in range(num_leagueId)]
    return (
        model,
        player,
        chem,
        z_teamId,
        z_leagueId,
        z_nation,
        b_c,
        b_l,
        b_n,
        teamId,
        nationId,
        leagueId,
        players_grouped,
    )


@runtime
def create_basic_constraints(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS
):
    """Create some essential constraints"""
    # Max players in squad
    model.Add(cp_model.LinearExpr.Sum(player) == NUM_PLAYERS)

    # Unique players constraint. Currently different players of same name not present in dataset.
    # Same player with multiple card versions present.
    for idx, expr in players_grouped["name"].items():
        model.Add(cp_model.LinearExpr.Sum(expr) <= 1)

    # Formation constraint
    # if input.PLAYERS_IN_POSITIONS == True:
    #     formation_list = input.formation_dict[input.FORMATION]
    #     cnt = {}
    #     for pos in formation_list:
    #         cnt[pos] = formation_list.count(pos)
    #     for pos, num in cnt.items():
    #         expr = players_grouped["possiblePositions"].get(
    #             map_idx["possiblePositions"][pos], [])
    #         model.Add(cp_model.LinearExpr.Sum(expr) == num)
    return model


@runtime
def create_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_nationId, NATIONS, SCOPE
):
    """Create nationId constraint (>=)"""
    for i, nation_list in enumerate(NATIONS):
        expr = []
        for nation in nation_list:
            try:
                expr += players_grouped["nationId"].get(map_idx["nationId"][nation], [])
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_nationId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_nationId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_nationId[i])

    return model


@runtime
def create_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_leagueId, LEAGUES, SCOPE
):
    """Create leagueId constraint (>=)"""
    for i, leagueId_list in enumerate(LEAGUES):
        expr = []
        for leagueId in leagueId_list:
            try:
                expr += players_grouped["leagueId"].get(
                    map_idx["leagueId"][leagueId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_leagueId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_leagueId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_leagueId[i])
    return model


@runtime
def create_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_teamId, TEAMS, SCOPE
):
    """Create teamId constraint (>=)"""
    for i, teamId_list in enumerate(TEAMS):
        expr = []
        for teamId in teamId_list:
            try:
                expr += players_grouped["teamId"].get(map_idx["teamId"][teamId], [])
            except Exception as error:
                print("An exception occurred:", error)
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_teamId[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_teamId[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_teamId[i])
    return model


@runtime
def create_rarity_group_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_RARITY_GROUP,
    RARITY_GROUPS,
):
    """Create rarity group constraint (>=)"""
    for i, groupId_list in enumerate(RARITY_GROUPS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["groups"].get(map_idx["groups"][groupId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY_GROUP[i])
    return model


@runtime
def create_exact_rarity_group_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_RARITY_GROUP,
    RARITY_GROUPS,
):
    """Create rarity group constraint (>=)"""
    for i, groupId_list in enumerate(RARITY_GROUPS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["groups"].get(map_idx["groups"][groupId], [])
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) == NUM_RARITY_GROUP[i])
    return model


@runtime
def create_rarity_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_RARITY, RARITIES
):
    """Create rarity constraint (>=)"""

    for i, groupId_list in enumerate(RARITIES):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["rarityId"].get(
                    map_idx["rarityId"][groupId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_RARITY[i])

    return model


@runtime
def create_player_level_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_LEVEL, LEVELS
):
    """Create rarity constraint (>=)"""

    for i, groupId_list in enumerate(LEVELS):
        expr = []
        for groupId in groupId_list:
            try:
                expr += players_grouped["ratingTier"].get(
                    map_idx["ratingTier"][groupId], []
                )
            except Exception as error:
                print("An exception occurred:", error)
        model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_LEVEL[i])

    return model


excess = []
R = {}
rat_expr = []


@runtime
def create_squad_rating_constraint_3(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    num_players,
    squad_rating,
    scope,
    max_overshoot=SQUAD_RATING_MAX_OVERSHOOT,
):
    """Create an exact EA-rating constraint using the active squad size."""
    num_players = int(num_players)
    total_rating = cp_model.LinearExpr.WeightedSum(
        player, [int(value) for value in df["rating"].tolist()]
    )

    rating_list = df["rating"].unique().tolist()
    excess = []

    for rating in rating_list:
        rating_idx = map_idx["rating"][rating]
        expr = players_grouped["rating"].get(rating_idx, [])

        R = model.NewIntVar(0, num_players, f"R{rating_idx}")
        model.Add(R == cp_model.LinearExpr.Sum(expr))

        diff_var = model.NewIntVar(
            -99 * num_players,
            99 * num_players,
            f"diff_{rating}",
        )
        model.Add(diff_var == int(rating) * num_players - total_rating)

        excess_var = model.NewIntVar(
            0, 99 * num_players, f"excess_{rating}"
        )
        model.AddMaxEquality(excess_var, [diff_var, 0])

        total_rating_excess = model.NewIntVar(
            0,
            99 * num_players * num_players,
            f"tre{rating}",
        )
        model.AddMultiplicationEquality(total_rating_excess, [R, excess_var])
        excess.append(total_rating_excess)

    sum_excess = cp_model.LinearExpr.Sum(excess)
    # adjusted_rating_numerator / num_players is the exact EA adjusted total.
    final_rating = cp_model.LinearExpr.Sum(
        [total_rating * num_players, sum_excess]
    )
    rounded_adjusted_total = model.NewIntVar(
        0,
        99 * num_players,
        "rounded_adjusted_total",
    )
    model.Add(
        2 * final_rating
        >= (2 * rounded_adjusted_total - 1) * num_players
    )
    model.Add(
        2 * final_rating
        <= (2 * rounded_adjusted_total + 1) * num_players - 1
    )
    displayed_rating_hundredths = model.NewIntVar(
        0,
        9900,
        "displayed_rating_hundredths",
    )
    model.Add(
        2 * rounded_adjusted_total * 100
        >= (2 * displayed_rating_hundredths - 1) * num_players
    )
    model.Add(
        2 * rounded_adjusted_total * 100
        <= (2 * displayed_rating_hundredths + 1) * num_players - 1
    )
    target_rating = float(squad_rating)
    if scope == "LOWER":
        target_hundredths = int(round(target_rating * 100))
        model.Add(displayed_rating_hundredths <= target_hundredths)
        rating_window = {
            "minimum": 0.0,
            "maximum": target_rating,
        }
    else:
        rating_window = squad_rating_window(
            target_rating,
            num_players,
            max_overshoot=max_overshoot,
        )
        model.Add(
            displayed_rating_hundredths
            >= int(round(rating_window["minimum"] * 100))
        )
        model.Add(
            displayed_rating_hundredths
            <= int(round(rating_window["maximum"] * 100))
        )
    return (
        model,
        displayed_rating_hundredths,
        total_rating,
        sum_excess,
        rating_window,
    )


@runtime
def create_squad_rating_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, num_players, squad_rating
):
    """Squad rating: Min XX (>=)"""
    ratings = df["rating"].tolist()
    df["avgratings"] = df["rating"] / num_players

    total_rating_expr = cp_model.LinearExpr.WeightedSum(player, ratings)

    average_rating = cp_model.LinearExpr.WeightedSum(player, df["avgratings"].tolist())
    # excess  (each player's rating - total avg rating)

    excess = [model.NewIntVar(0, 99, f"excess{i}") for i in range(len(ratings))]
    [
        model.AddMaxEquality(
            excess[i], [(player[i] * (ratings[i] - average_rating)), 0]
        )
        for i in range(len(player))
    ]

    sum_excess = cp_model.LinearExpr.WeightedSum(player, excess)
    total_squad_rating = total_rating_expr + sum_excess
    model.Add(total_squad_rating >= squad_rating * num_players)
    return model, total_rating_expr, sum_excess


@runtime
def create_min_overall_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_MIN_OVERALL,
    MIN_OVERALL,
    SCOPE,
):
    """
    Minimum OVR constraint.
    MIN_OVERALL[i] with SCOPE applies to the count of players whose rating >= MIN_OVERALL[i].

    SCOPE semantics:
      GREATER / GREATER_OR_EQUAL : Sum >= NUM_MIN_OVERALL[i]
      LOWER / LESS               : Sum <= NUM_MIN_OVERALL[i]
      EXACT                      : Sum == NUM_MIN_OVERALL[i]
    """
    max_rating = int(df["rating"].max())
    for i, threshold in enumerate(MIN_OVERALL):
        expr = []
        for rat in range(threshold, max_rating + 1):
            if rat not in map_idx["rating"]:
                continue
            expr.extend(players_grouped["rating"].get(map_idx["rating"][rat], []))
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_MIN_OVERALL[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_MIN_OVERALL[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_MIN_OVERALL[i])
        else:
            raise ValueError(
                f"Unsupported SCOPE '{SCOPE}' for create_min_overall_constraint"
            )
    return model


@runtime
def create_max_overall_constraint(
    df,
    model,
    player,
    map_idx,
    players_grouped,
    num_cnts,
    NUM_MAX_OVERALL,
    MAX_OVERALL,
    SCOPE,
):
    for i, threshold in enumerate(MAX_OVERALL):
        expr = []
        # Collect players with rating <= threshold
        for rat in map_idx["rating"].keys():
            if rat <= threshold:
                expr.extend(players_grouped["rating"].get(map_idx["rating"][rat], []))
        if SCOPE == "GREATER":
            model.Add(cp_model.LinearExpr.Sum(expr) >= NUM_MAX_OVERALL[i])
        elif SCOPE == "LOWER":
            model.Add(cp_model.LinearExpr.Sum(expr) <= NUM_MAX_OVERALL[i])
        elif SCOPE == "EXACT":
            model.Add(cp_model.LinearExpr.Sum(expr) == NUM_MAX_OVERALL[i])
        else:
            raise ValueError(
                f"Unsupported SCOPE '{SCOPE}' for create_max_overall_constraint"
            )
    return model


@runtime
def create_player_exact_overall_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, NUM_MAX_OVERALL, MAX_OVERALL
):
    """Exact Max OVR of XX"""

    for i, rating in enumerate(MAX_OVERALL):
        model.Add(
            cp_model.LinearExpr.Sum(
                players_grouped["rating"].get(map_idx["rating"][rating], [])
            )
            == NUM_MAX_OVERALL[i]
        )
    return model


def _setup_player_chemistry(
    model,
    df,
    i,
    chem,
    player,
    pos,
    formation_list,
    teamId_dict,
    leagueId_dict,
    nationId_dict,
    z_teamId,
    z_leagueId,
    z_nation,
    CHEM_PER_PLAYER,
):
    """Setup chemistry for a single player"""
    p_teamId, p_leagueId, p_nation, p_pos = (
        df.at[i, "teamId"],
        df.at[i, "leagueId"],
        df.at[i, "nationId"],
        df.at[i, "possiblePositions"],
    )

    pos.append(model.NewBoolVar(f"_pos{i}"))
    if p_pos in formation_list:
        if df.at[i, "teamId"] in ["ICON", "HERO"]:
            model.Add(chem[i] == 3)
        else:
            sum_expr = (
                z_teamId[teamId_dict[p_teamId]]
                + z_leagueId[leagueId_dict[p_leagueId]]
                + z_nation[nationId_dict[p_nation]]
            )
            b = model.NewBoolVar(f"b{i}")
            model.Add(sum_expr <= 3).OnlyEnforceIf(b)
            model.Add(sum_expr > 3).OnlyEnforceIf(b.Not())
            model.Add(chem[i] == sum_expr).OnlyEnforceIf(b)
            model.Add(chem[i] == 3).OnlyEnforceIf(b.Not())
    else:
        model.Add(chem[i] == 0)
        model.Add(pos[i] == 0)

    model.Add(chem[i] >= CHEM_PER_PLAYER).OnlyEnforceIf(player[i])
    return model


def _setup_position_constraints(
    model, df, player, pos, players_grouped, pos_dict, formation_list
):
    """Setup constraints for player positions"""
    pos_expr = []  # Players whose possiblePositions is there in the input formation.
    pos_players_by_pos = {}  # Track players by position for easier lookup

    # Build position mapping
    for Pos in set(formation_list):
        if Pos not in pos_dict:
            continue
        t_expr = players_grouped["possiblePositions"].get(pos_dict[Pos], [])
        pos_expr.extend(t_expr)
        pos_players_by_pos[Pos] = t_expr

        play_pos_list = []
        for i, p in enumerate(t_expr):
            play_pos = model.NewBoolVar(f"play_pos{Pos}{i}")
            idx = player.index(p)  # Get index of player variable
            model.AddMultiplicationEquality(play_pos, p, pos[idx])
            play_pos_list.append(play_pos)

        model.Add(cp_model.LinearExpr.Sum(play_pos_list) <= formation_list.count(Pos))

    return model, pos_expr


def _setup_team_chemistry(
    model,
    df,
    player,
    pos,
    players_grouped,
    pos_expr,
    b_c,
    z_teamId,
    num_teamIds,
    NUM_PLAYERS,
):
    """Setup team chemistry constraints"""
    teamId_bucket = [[0, 1], [2, 3], [4, 6], [7, NUM_PLAYERS]]

    for j in range(num_teamIds):
        t_expr = players_grouped["teamId"].get(j, [])
        # Filter players that have a position in formation
        t_expr_1 = [p for p in t_expr if p in pos_expr]
        expr = []
        for i, p in enumerate(t_expr_1):
            # Heroes or Icons don't contribute to teamId chem.
            idx = player.index(p)
            if df.at[idx, "teamId"] in ["ICON", "HERO"]:
                continue
            t_var = model.NewBoolVar(f"t_var_c{i}")
            model.AddMultiplicationEquality(t_var, p, pos[idx])
            expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = teamId_bucket[idx][0], teamId_bucket[idx][1]
            model.AddLinearConstraint(sum_expr, lb, ub).OnlyEnforceIf(b_c[j][idx])
            model.Add(z_teamId[j] == idx).OnlyEnforceIf(b_c[j][idx])
        model.AddExactlyOne(b_c[j])

    return model


def _setup_league_chemistry(
    model,
    df,
    player,
    pos,
    players_grouped,
    pos_expr,
    b_l,
    z_leagueId,
    num_leagueId,
    teamId_dict,
    NUM_PLAYERS,
):
    """Setup league chemistry constraints"""
    leagueId_bucket = [[0, 2], [3, 4], [5, 7], [8, NUM_PLAYERS]]
    icons_expr = players_grouped["teamId"].get(teamId_dict.get("ICON", -1), [])

    for j in range(num_leagueId):
        t_expr = players_grouped["leagueId"].get(j, [])
        # In EA FC 24, Icons add 1 chem to every leagueId in the squad.
        if icons_expr:
            t_expr.extend(icons_expr)
        # Filter players that have a position in formation
        t_expr_1 = [p for p in t_expr if p in pos_expr]
        expr = []
        for i, p in enumerate(t_expr_1):
            idx = player.index(p)
            t_var = model.NewBoolVar(f"t_var_l{i}")
            model.AddMultiplicationEquality(t_var, p, pos[idx])
            # Heroes contribute 2x to leagueId chem.
            if df.at[idx, "teamId"] == "HERO":
                expr.append(2 * t_var)
            else:
                expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = leagueId_bucket[idx][0], leagueId_bucket[idx][1]
            model.AddLinearConstraint(sum_expr, lb, ub).OnlyEnforceIf(b_l[j][idx])
            model.Add(z_leagueId[j] == idx).OnlyEnforceIf(b_l[j][idx])
        model.AddExactlyOne(b_l[j])

    return model


def _setup_nation_chemistry(
    model,
    df,
    player,
    pos,
    players_grouped,
    pos_expr,
    b_n,
    z_nation,
    num_nationId,
    NUM_PLAYERS,
):
    """Setup nation chemistry constraints"""
    nationId_bucket = [[0, 1], [2, 4], [5, 7], [8, NUM_PLAYERS]]

    for j in range(num_nationId):
        t_expr = players_grouped["nationId"].get(j, [])
        # Filter players that have a position in formation
        t_expr_1 = [p for p in t_expr if p in pos_expr]
        expr = []
        for i, p in enumerate(t_expr_1):
            idx = player.index(p)
            t_var = model.NewBoolVar(f"t_var_n{i}")
            model.AddMultiplicationEquality(t_var, p, pos[idx])
            # Icons contribute 2x to nationId chem.
            if df.at[idx, "teamId"] == "ICON":
                expr.append(2 * t_var)
            else:
                expr.append(t_var)
        sum_expr = cp_model.LinearExpr.Sum(expr)
        for idx in range(4):
            lb, ub = nationId_bucket[idx][0], nationId_bucket[idx][1]
            model.AddLinearConstraint(sum_expr, lb, ub).OnlyEnforceIf(b_n[j][idx])
            model.Add(z_nation[j] == idx).OnlyEnforceIf(b_n[j][idx])
        model.AddExactlyOne(b_n[j])

    return model

@runtime
def create_chemistry_constraint(
    df,
    model,
    chem,
    z_teamId,
    z_leagueId,
    z_nation,
    player,
    players_grouped,
    num_cnts,
    map_idx,
    b_c,
    b_l,
    b_n,
    formation,
    CHEMISTRY,
    CHEM_PER_PLAYER,
    NUM_PLAYERS,
):
    """Optimize Chemistry (>=) - Position-based constraint creation"""
    # Log function start
    add_log(
        f"Creating chemistry constraint with target: {CHEMISTRY}, min per player: {CHEM_PER_PLAYER}"
    )

    num_players = num_cnts[0]

    # Get mapping dictionaries
    teamId_dict = map_idx["teamId"]
    leagueId_dict = map_idx["leagueId"]
    nationId_dict = map_idx["nationId"]
    pos_dict = map_idx["possiblePositions"]

    # Chemistry bucket definitions
    teamId_bucket = [[0, 1], [2, 3], [4, 6], [7, NUM_PLAYERS]]
    leagueId_bucket = [[0, 2], [3, 4], [5, 7], [8, NUM_PLAYERS]]
    nationId_bucket = [[0, 1], [2, 4], [5, 7], [8, NUM_PLAYERS]]

    # Pre-compute formation data
    formation_list = formation
    formation_positions = set(formation_list)
    position_counts = {pos: formation_list.count(pos) for pos in formation_positions}

    add_log(f"Formation: {formation_list}")
    add_log(f"Positions in formation: {position_counts}")

    # Initialize variables for tracking
    pos = []
    chem_expr = []

    # Setup position variables and chemistry calculations only for selected players
    add_log("Setting up position variables and chemistry calculations")

    # Track selected players by team, league, and nation
    team_players = {
        i: [] for i in range(num_cnts[1])
    }  # team_players[team_idx] = list of selected players
    league_players = {i: [] for i in range(num_cnts[2])}
    nation_players = {i: [] for i in range(num_cnts[3])}

    # For each player, create variables
    for i in range(num_players):
        pos_var = model.NewBoolVar(f"pos_{i}")
        pos.append(pos_var)
        chem_expr.append(model.NewIntVar(0, 3, f"chem_expr_{i}"))

        p_pos = df.at[i, "possiblePositions"]

        # Player can only have position if they are in the correct position in formation
        if p_pos in formation_positions:
            # Create a variable that is 1 if player is selected AND in position
            player_in_pos = model.NewBoolVar(f"player_in_pos_{i}")
            model.AddMultiplicationEquality(player_in_pos, player[i], pos[i])

            # Calculate chemistry for this player if selected
            p_teamId = df.at[i, "teamId"]
            p_leagueId = df.at[i, "leagueId"]
            p_nation = df.at[i, "nationId"]

            team_idx = teamId_dict[p_teamId]
            league_idx = leagueId_dict[p_leagueId]
            nation_idx = nationId_dict[p_nation]

            # Track this player for team, league, and nation counts
            team_players[team_idx].append(player_in_pos)
            league_players[league_idx].append(player_in_pos)
            nation_players[nation_idx].append(player_in_pos)

            # Chemistry calculation for selected players in position
            sum_expr = (
                z_teamId[team_idx] + z_leagueId[league_idx] + z_nation[nation_idx]
            )

            # Cap chemistry at 3
            b = model.NewBoolVar(f"b_chem_{i}")
            model.Add(sum_expr <= 3).OnlyEnforceIf([b, player_in_pos])
            model.Add(sum_expr > 3).OnlyEnforceIf([b.Not(), player_in_pos])
            model.Add(chem[i] == sum_expr).OnlyEnforceIf([b, player_in_pos])
            model.Add(chem[i] == 3).OnlyEnforceIf([b.Not(), player_in_pos])

            # If player not selected or not in position, chemistry is 0
            model.Add(chem[i] == 0).OnlyEnforceIf(player_in_pos.Not())
        else:
            # Player not in formation position, cannot contribute chemistry
            model.Add(pos[i] == 0)
            model.Add(chem[i] == 0)

    # Enforce position counts from the formation
    for position in formation_positions:
        if position not in pos_dict:
            continue

        position_idx = pos_dict[position]
        count_needed = position_counts[position]
        position_expr = []

        # Get all players eligible for this position who are selected
        for i in range(num_players):
            if df.at[i, "possiblePositions"] == position:
                # Create a variable that is 1 if player is selected AND in position
                player_in_pos = model.NewBoolVar(f"player_in_pos_{position}_{i}")
                model.AddMultiplicationEquality(player_in_pos, player[i], pos[i])
                position_expr.append(player_in_pos)

        # Enforce the count constraint
        model.Add(sum(position_expr) <= count_needed)

    add_log("Setting up team chemistry tiers")
    # Apply team chemistry tiers
    for team_idx, team_players_list in team_players.items():
        if team_players_list:
            team_sum = sum(team_players_list)
            for idx, (lb, ub) in enumerate(teamId_bucket):
                model.AddLinearConstraint(team_sum, lb, ub).OnlyEnforceIf(
                    b_c[team_idx][idx]
                )
                model.Add(z_teamId[team_idx] == idx).OnlyEnforceIf(b_c[team_idx][idx])
            model.AddExactlyOne(b_c[team_idx])

    add_log("Setting up league chemistry tiers")
    # Apply league chemistry tiers
    for league_idx, league_players_list in league_players.items():
        if league_players_list:
            league_sum = sum(league_players_list)
            for idx, (lb, ub) in enumerate(leagueId_bucket):
                model.AddLinearConstraint(league_sum, lb, ub).OnlyEnforceIf(
                    b_l[league_idx][idx]
                )
                model.Add(z_leagueId[league_idx] == idx).OnlyEnforceIf(
                    b_l[league_idx][idx]
                )
            model.AddExactlyOne(b_l[league_idx])

    add_log("Setting up nation chemistry tiers")
    # Apply nation chemistry tiers
    for nation_idx, nation_players_list in nation_players.items():
        if nation_players_list:
            nation_sum = sum(nation_players_list)
            for idx, (lb, ub) in enumerate(nationId_bucket):
                model.AddLinearConstraint(nation_sum, lb, ub).OnlyEnforceIf(
                    b_n[nation_idx][idx]
                )
                model.Add(z_nation[nation_idx] == idx).OnlyEnforceIf(
                    b_n[nation_idx][idx]
                )
            model.AddExactlyOne(b_n[nation_idx])

    # Total chemistry requirement
    if CHEMISTRY > 0:
        total_chemistry = []
        for i in range(num_players):
            player_chem = model.NewIntVar(0, 3, f"player_chem_{i}")
            model.AddMultiplicationEquality(player_chem, player[i], chem[i])
            total_chemistry.append(player_chem)

        model.Add(cp_model.LinearExpr.Sum(total_chemistry) >= CHEMISTRY)
        add_log(f"Added constraint for total chemistry >= {CHEMISTRY}")

    # Per-player chemistry requirement
    if CHEM_PER_PLAYER > 0:
        for i in range(num_players):
            model.Add(chem[i] >= CHEM_PER_PLAYER).OnlyEnforceIf(player[i])
            add_log(f"Each selected player must have chemistry >= {CHEM_PER_PLAYER}")

    return model, pos, chem_expr


@runtime
def create_max_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_teamId
):
    """Same teamId Count: Max X / Max X Players from the Same teamId (<=)"""
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_teamId)
    return model


@runtime
def create_max_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_leagueId
):
    """Same leagueId Count: Max X / Max X Players from the Same leagueId (<=)"""
    num_leagueId = num_cnts[2]
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_leagueId)
    return model


@runtime
def create_max_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MAX_NUM_nationId
):
    """Same Nation Count: Max X / Max X Players from the Same Nation (<=)"""
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) <= MAX_NUM_nationId)
    return model


@runtime
def create_min_teamId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_teamId
):
    """Same teamId Count: Min X / Min X Players from the Same teamId (>=)"""
    num_teamIds = num_cnts[1]
    B_C = [model.NewBoolVar(f"B_C{i}") for i in range(num_teamIds)]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_teamId).OnlyEnforceIf(B_C[i])
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_teamId).OnlyEnforceIf(
            B_C[i].Not()
        )
    model.AddAtLeastOne(B_C)
    return model


@runtime
def create_min_leagueId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_leagueId
):
    """Same leagueId Count: Min X / Min X Players from the Same leagueId (>=)"""
    num_leagueId = num_cnts[2]
    B_L = [model.NewBoolVar(f"B_L{i}") for i in range(num_leagueId)]
    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_leagueId).OnlyEnforceIf(
            B_L[i]
        )
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_leagueId).OnlyEnforceIf(
            B_L[i].Not()
        )
    model.AddAtLeastOne(B_L)
    return model


@runtime
def create_min_nationId_constraint(
    df, model, player, map_idx, players_grouped, num_cnts, MIN_NUM_nationId
):
    """Same Nation Count: Min X / Min X Players from the Same Nation (>=)"""
    num_nationId = num_cnts[3]
    B_N = [model.NewBoolVar(f"B_N{i}") for i in range(num_nationId)]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= MIN_NUM_nationId).OnlyEnforceIf(
            B_N[i]
        )
        model.Add(cp_model.LinearExpr.Sum(expr) < MIN_NUM_nationId).OnlyEnforceIf(
            B_N[i].Not()
        )
    model.AddAtLeastOne(B_N)
    return model


@runtime
def create_unique_teamId_constraint(
    df, model, player, teamId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_teamId
):
    """teamIds: Max / Min / Exactly X"""
    num_teamIds = num_cnts[1]
    for i in range(num_teamIds):
        expr = players_grouped["teamId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(teamId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(teamId[i].Not())
    if NUM_UNIQUE_teamId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(teamId) >= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(teamId) <= NUM_UNIQUE_teamId[0])
    elif NUM_UNIQUE_teamId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(teamId) == NUM_UNIQUE_teamId[0])
    else:
        print("**Couldn't create unique_teamId_constraint!**")
    return model


@runtime
def create_unique_leagueId_constraint(
    df, model, player, leagueId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_leagueId
):
    """leagueIds: Max / Min / Exactly X"""
    num_leagueId = num_cnts[2]

    for i in range(num_leagueId):
        expr = players_grouped["leagueId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(leagueId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(leagueId[i].Not())
    if NUM_UNIQUE_leagueId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(leagueId) >= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(leagueId) <= NUM_UNIQUE_leagueId[0])
    elif NUM_UNIQUE_leagueId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(leagueId) == NUM_UNIQUE_leagueId[0])
    else:
        print("**Couldn't create unique_leagueId_constraint!**")
    return model


@runtime
def create_unique_nationId_constraint(
    df, model, player, nationId, map_idx, players_grouped, num_cnts, NUM_UNIQUE_nationId
):
    """Nations: Max / Min / Exactly X"""
    num_nationId = num_cnts[3]
    for i in range(num_nationId):
        expr = players_grouped["nationId"].get(i, [])
        model.Add(cp_model.LinearExpr.Sum(expr) >= 1).OnlyEnforceIf(nationId[i])
        model.Add(cp_model.LinearExpr.Sum(expr) == 0).OnlyEnforceIf(nationId[i].Not())
    if NUM_UNIQUE_nationId[1] == "GREATER":
        model.Add(cp_model.LinearExpr.Sum(nationId) >= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "LOWER":
        model.Add(cp_model.LinearExpr.Sum(nationId) <= NUM_UNIQUE_nationId[0])
    elif NUM_UNIQUE_nationId[1] == "EXACT":
        model.Add(cp_model.LinearExpr.Sum(nationId) == NUM_UNIQUE_nationId[0])
    else:
        print("**Couldn't create unique_nationId_constraint!**")
    return model


MINIMIZE_MAX_COST = False
MAXIMIZE_TOTAL_COST = False


@runtime
def set_objective(
    df,
    model,
    player,
):
    """Set objective based on player cost.
    The default behaviour of the solver is to minimize the overall cost.
    """
    cost = df["price"].tolist()
    if MINIMIZE_MAX_COST:
        print("**MINIMIZE_MAX_COST**")
        max_cost = model.NewIntVar(0, df["price"].max(), "max_cost")
        play_cost = [player[i] * cost[i] for i in range(len(cost))]
        model.AddMaxEquality(max_cost, play_cost)
        model.Minimize(max_cost)
    elif MAXIMIZE_TOTAL_COST:
        print("**MAXIMIZE_TOTAL_COST**")
        model.Maximize(cp_model.LinearExpr.WeightedSum(player, cost))
    else:
        print("**MINIMIZE_TOTAL_COST**")
        model.Minimize(cp_model.LinearExpr.WeightedSum(player, cost))
    return model


def _new_solver(time_limit_seconds):
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.01, float(time_limit_seconds))
    solver.parameters.log_search_progress = True
    solver.parameters.num_search_workers = min(
        4, max(1, int(os.getenv("FCX_SOLVER_SEARCH_WORKERS", "4")))
    )
    return solver


def _status_code(raw_status):
    try:
        return int(raw_status)
    except Exception:
        return 0


@runtime
def solve_minimum_rating_then_cost(
    df,
    model,
    player,
    rating_priority,
    rating_window,
    max_solve_time,
):
    """Prove the minimum displayed EA rating, then optimize cost at that rating."""
    total_budget = min(60.0, max(1.0, float(max_solve_time)))
    started_at = time.monotonic()
    model.Minimize(rating_priority)
    add_log(
        "Rating stage started: "
        f"window {rating_window['minimum']:.2f}-{rating_window['maximum']:.2f}"
    )
    rating_solver = _new_solver(total_budget)
    rating_status = _status_code(rating_solver.Solve(model))
    rating_elapsed = time.monotonic() - started_at
    diagnostics = {
        "target": rating_window["minimum"],
        "window_min": rating_window["minimum"],
        "window_max": rating_window["maximum"],
        "minimum_rating": None,
        "rating_optimal": rating_status == 4,
        "cost_optimal": False,
        "rating_stage_status": rating_status,
        "cost_stage_status": None,
    }
    add_log(
        "Rating stage completed: "
        f"status {status_dict.get(rating_status, rating_status)}, "
        f"elapsed {rating_elapsed:.2f}s"
    )
    if rating_status == 3:
        diagnostics["failure_code"] = "RATING_WINDOW_INFEASIBLE"
        return None, 3, diagnostics
    if rating_status != 4:
        diagnostics["failure_code"] = "RATING_OPTIMUM_NOT_PROVEN"
        return None, 0, diagnostics

    minimum_hundredths = int(rating_solver.Value(rating_priority))
    diagnostics["minimum_rating"] = minimum_hundredths / 100
    add_log(
        "Minimum squad rating proven: "
        f"{diagnostics['minimum_rating']:.2f}"
    )
    model.Add(rating_priority == minimum_hundredths)
    set_objective(df, model, player)

    remaining = total_budget - (time.monotonic() - started_at)
    if remaining <= 0.05:
        add_log("No time remains for cost optimization; using the rating-stage solution")
        return rating_solver, 2, diagnostics

    add_log(f"Cost stage started with {remaining:.2f}s remaining")
    cost_solver = _new_solver(remaining)
    cost_status = _status_code(cost_solver.Solve(model))
    diagnostics["cost_stage_status"] = cost_status
    diagnostics["cost_optimal"] = cost_status == 4
    add_log(
        "Cost stage completed: "
        f"status {status_dict.get(cost_status, cost_status)}"
    )
    if cost_status in (2, 4):
        return cost_solver, cost_status, diagnostics

    add_log("Cost stage returned no solution; using the proven minimum-rating solution")
    return rating_solver, 2, diagnostics


def get_dict(df, col):
    """Map fields to a unique index"""
    d = {}
    unique_col = df[col].unique()
    for i, val in enumerate(unique_col):
        d[val] = i
    return d


@runtime
def SBC(df, sbc, maxSolveTime):
    """Optimize SBC using Constraint Integer Programming"""
    # Add global reference
    global solver_logs
    solver_logs = []  # Clear previous logs

    # Log start of solving
    solver_logs.append({"time": time.time(), "message": "Starting SBC solver"})

    num_cnts = [
        df.shape[0],
        df.teamId.nunique(),
        df.leagueId.nunique(),
        df.nationId.nunique(),
        df.ratingTier.nunique(),
    ]  # Count of important fields
    map_idx = {}  # Map fields to a unique index
    fields = [
        "teamId",
        "leagueId",
        "nationId",
        "possiblePositions",
        "rating",
        "ratingTier",
        "groups",
        "rarityId",
        "name",
    ]
    for field in fields:
        map_idx[field] = get_dict(df, field)

    """Create the CP-SAT Model"""
    model = cp_model.CpModel()

    """Create essential variables and do some pre-processing"""

    (
        model,
        player,
        chem,
        z_teamId,
        z_leagueId,
        z_nation,
        b_c,
        b_l,
        b_n,
        teamId,
        nationId,
        leagueId,
        players_grouped,
    ) = create_var(model, df, map_idx, num_cnts, sbc)

    """Essential constraints"""
    NUM_PLAYERS = 11 - len(sbc["brickIndices"])
    model = create_basic_constraints(
        df, model, player, map_idx, players_grouped, num_cnts, NUM_PLAYERS
    )

    """Comment out the constraints not required"""
    CHEMISTRY = 0
    CHEM_PER_PLAYER = 0

    rating_priority = None
    rating_window = None
    for req in sbc["constraints"]:
        print("Adding Constraint for ", req)
        if req["requirementKey"] == "CHEMISTRY_POINTS":
            CHEMISTRY = req["eligibilityValues"][0]
        if req["requirementKey"] == "ALL_PLAYERS_CHEMISTRY_POINTS":
            CHEM_PER_PLAYER = req["eligibilityValues"][0]

        if req["requirementKey"] == "SAME_LEAGUE_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_leagueId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_leagueId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "SAME_NATION_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_nationId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_nationId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "SAME_CLUB_COUNT":
            if req["scope"] == "LOWER" or req["scope"] == "EXACT":
                model = create_max_teamId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )
            if req["scope"] == "GREATER" or req["scope"] == "EXACT":
                model = create_min_teamId_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    req["eligibilityValues"][0],
                )

        if req["requirementKey"] == "NATION_COUNT":
            model = create_unique_nationId_constraint(
                df,
                model,
                player,
                nationId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )
        if req["requirementKey"] == "LEAGUE_COUNT":
            model = create_unique_leagueId_constraint(
                df,
                model,
                player,
                leagueId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )
        if req["requirementKey"] == "CLUB_COUNT":
            model = create_unique_teamId_constraint(
                df,
                model,
                player,
                teamId,
                map_idx,
                players_grouped,
                num_cnts,
                [req["eligibilityValues"][0], req["scope"]],
            )

        if req["requirementKey"] == "CLUB_ID":
            model = create_teamId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )
        if req["requirementKey"] == "LEAGUE_ID":
            model = create_leagueId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )

        if req["requirementKey"] == "NATION_ID":
            model = create_nationId_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
                req["scope"],
            )

        if req["requirementKey"] == "PLAYER_RARITY_GROUP":
            if req["scope"] == "EXACT":
                model = create_exact_rarity_group_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    [req["count"]],
                    [req["eligibilityValues"]],
                )
            if req["scope"] == "GREATER":
                model = create_rarity_group_constraint(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    [req["count"]],
                    [req["eligibilityValues"]],
                )

        if req["requirementKey"] == "PLAYER_RARITY":
            model = create_rarity_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
            )
        if req["requirementKey"] == "PLAYER_MIN_OVR":
            model = create_min_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
                req["scope"],
            )
        if req["requirementKey"] == "PLAYER_MAX_OVR":
            model = create_max_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
                req["scope"],
            )
        if req["requirementKey"] == "PLAYER_EXACT_OVR":
            model = create_player_exact_overall_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"][0]],
            )
        if req["requirementKey"] == "TEAM_RATING":
            model, final_rating, total_rating, sum_excess, current_window = (
                create_squad_rating_constraint_3(
                    df,
                    model,
                    player,
                    map_idx,
                    players_grouped,
                    num_cnts,
                    NUM_PLAYERS,
                    req["eligibilityValues"][0],
                    req["scope"],
                    sbc.get("ratingOvershoot", SQUAD_RATING_MAX_OVERSHOOT),
                )
            )
            if req["scope"] != "LOWER":
                rating_priority = final_rating
                rating_window = current_window

        if req["requirementKey"] == "PLAYER_LEVEL":
            model = create_player_level_constraint(
                df,
                model,
                player,
                map_idx,
                players_grouped,
                num_cnts,
                [req["count"]],
                [req["eligibilityValues"]],
            )

    """If there is no constraint on total chemistry, simply set CHEMISTRY = 0"""
    if CHEMISTRY + CHEM_PER_PLAYER > 0:
        model, pos, chem_expr = create_chemistry_constraint(
            df,
            model,
            chem,
            z_teamId,
            z_leagueId,
            z_nation,
            player,
            players_grouped,
            num_cnts,
            map_idx,
            b_c,
            b_l,
            b_n,
            sbc["formation"],
            CHEMISTRY,
            CHEM_PER_PLAYER,
            NUM_PLAYERS,
        )

    """Fix specific players and optimize the rest"""
    # model = fix_players(df, model, player, NUM_PLAYERS)

    """Export Model to file"""
    # model.ExportToFile('model.txt')

    """Solve"""
    print("Solve Started")
    solver_logs.append({"time": time.time(), "message": "Solve Started"})

    rating_optimization = None
    if rating_priority is not None and rating_window is not None:
        solver, status, rating_optimization = solve_minimum_rating_then_cost(
            df,
            model,
            player,
            rating_priority,
            rating_window,
            maxSolveTime,
        )
    else:
        set_objective(df, model, player)
        solver = _new_solver(min(60, max(1, float(maxSolveTime))))
        callback = SolutionCallback(timer_limit=30, player=player)
        status = _status_code(solver.Solve(model, callback))
    print("\n")
    final_players = []

    if solver is not None and (status == 2 or status == 4):
        for req in sbc["constraints"]:
            if req["requirementKey"] == "TEAM_RATING":
                print("Total Rating: ", solver.Value(total_rating))
                print("Excess: ", solver.Value(sum_excess))
                if rating_window is not None:
                    print(
                        "Rating Window: ",
                        f"{rating_window['minimum']:.2f}-{rating_window['maximum']:.2f}",
                    )
        df["Chemistry"] = 0
        # Is_Pos = 1 => Player should be placed in their respective possiblePositions.
        df["Is_Pos"] = 0
        for i in range(num_cnts[0]):
            if solver.Value(player[i]) == 1 and df.loc[i, "cardType"] != "BRICK":
                final_players.append(i)
                try:
                    df.loc[i, "Chemistry"] = solver.Value(chem_expr[i])
                    df.loc[i, "Is_Pos"] = solver.Value(pos[i])
                except:
                    pass
    if (
        rating_optimization
        and rating_optimization.get("failure_code") == "RATING_OPTIMUM_NOT_PROVEN"
    ):
        status_message = (
            "RATING_OPTIMUM_NOT_PROVEN: The solver found a feasible squad but "
            "could not prove that its rating was minimal before the time limit."
        )
    else:
        status_message = status_dict.get(status, str(status))
    return final_players, status_message, status, rating_optimization


status_dict = {
    0: "UNKNOWN: The status of the model is still unknown. A search limit has been reached before any of the statuses below could be determined.",
    1: "MODEL_INVALID: The given CpModelProto didn't pass the validation step.",
    2: "FEASIBLE: A feasible solution has been found. But the search was stopped before we could prove optimality.",
    3: "INFEASIBLE: The problem has been proven infeasible.",
    4: "OPTIMAL: An optimal feasible solution has been found.",
}
