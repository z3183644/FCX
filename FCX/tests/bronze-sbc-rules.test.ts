import { describe, expect, it } from "vitest";

import { resolveCandidateRules } from "../src/config/fcx-sbc-recommendations";
import { isBackendCandidate } from "../src/domain/sbc/player-filter";
import type { SettingKey, SolverSettings } from "../src/types/settings";

const own = <K extends SettingKey>(
  setId: number | string,
  challengeId: number | string,
  key: K,
): SolverSettings[K] | undefined => {
  if (Number(setId) === 0 && Number(challengeId) === 0 && key === "ratingRange") {
    return [65, 93] as SolverSettings[K];
  }
  return undefined;
};

const inherited = <K extends SettingKey>(
  setId: number | string,
  challengeId: number | string,
  key: K,
): SolverSettings[K] | undefined =>
  own(setId, challengeId, key) ?? own(setId, 0, key) ?? own(0, 0, key);

const exclusions = {
  leagues: [] as number[],
  nations: [] as number[],
  teams: [] as number[],
  rarities: [] as string[],
  excludeSbcSquads: false,
  excludeSbc: false,
  excludeObjective: false,
  excludeTradable: false,
  excludeExtinct: false,
  onlyStorage: false,
  priceRange: [null, null] as [null, null],
  commonOnly: false,
  skipPriceRange: false,
  specialFuelRulesEnabled: false,
  specialFuelRatingRange: [0, 99] as [number, number],
  specialFuelPriceRange: [null, null] as [null, null],
  specialFuelOnlyStorage: false,
  specialFuelStorageRulesEnabled: false,
  specialFuelStorageRatingRange: [0, 99] as [number, number],
};

const candidate = (rating: number, ratingRange: readonly [number, number]) => ({
  loanCount: -1,
  sbcPrice: 100,
  marketPrice: 100,
  rating,
  ratingRange,
  definitionId: rating,
  leagueId: 1,
  nationId: 1,
  teamId: 1,
  rarityLabel: "普通",
  isSbcPlayer: false,
  timeLimited: false,
  rewardFromSbc: false,
  rewardFromObjective: false,
  rareflag: 0,
  tradeable: false,
  extinct: false,
  storage: false,
  substitute: false,
  requiredSpecialFuel: false,
});

describe("FCX bronze SBC candidate defaults", () => {
  it.each([
    { setId: 5, challengeId: 16, requirement: "PLAYER_QUALITY / EXACT / 1" },
    { setId: 1035, challengeId: 3068, requirement: "PLAYER_LEVEL / GREATER / 1" },
  ])("keeps 40-rated bronze candidates for $requirement", ({ setId, challengeId }) => {
    const rules = resolveCandidateRules(setId, challengeId, inherited, own);
    expect(rules.ratingRange).toEqual([40, 93]);
    expect(isBackendCandidate(candidate(39, rules.ratingRange), exclusions)).toBe(false);
    expect(isBackendCandidate(candidate(40, rules.ratingRange), exclusions)).toBe(true);
  });
});
