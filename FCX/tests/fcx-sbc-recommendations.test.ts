import { describe, expect, it } from "vitest";
import {
  FCX_SBC_MIN_RATING_RECOMMENDATIONS,
  FCX_SBC_RECOMMENDATIONS,
  FCX_SBC_RULE_SNAPSHOT_VERSION,
  hasActivePriceRange,
  normalizeSquadRatingOvershoot,
  resolveCandidateRules,
} from "../src/config/fcx-sbc-recommendations";
import type { SettingKey, SolverSettings } from "../src/types/settings";

const readers = (scopes: Record<string, Partial<SolverSettings>>) => {
  const own = <K extends SettingKey>(setId: number | string, challengeId: number | string, key: K) =>
    scopes[`${setId}:${challengeId}`]?.[key] as SolverSettings[K] | undefined;
  const inherited = <K extends SettingKey>(setId: number | string, challengeId: number | string, key: K) =>
    own(setId, challengeId, key) ?? own(setId, 0, key) ?? own(0, 0, key);
  return { own, inherited };
};

describe("FCX SBC recommendation snapshot", () => {
  it("contains the v48 offline recommendations and FCX exceptions", () => {
    expect(FCX_SBC_RULE_SNAPSHOT_VERSION).toBe(48);
    expect(FCX_SBC_RECOMMENDATIONS[1039]).toEqual({ minRating: 75, maxRating: 87 });
    expect(FCX_SBC_RECOMMENDATIONS[1017]).toEqual({ minRating: 73 });
    expect(FCX_SBC_RECOMMENDATIONS[1321]).toEqual({ minRating: 77, maxRating: 91 });
    expect(FCX_SBC_RECOMMENDATIONS[1332]).toEqual({ maxRating: 82 });
    expect(FCX_SBC_RECOMMENDATIONS[1254]).toEqual({ priceRange: [null, 25_000] });
    expect(FCX_SBC_RECOMMENDATIONS[1261]).toEqual({ maxRating: 82, commonOnly: true });
    expect(FCX_SBC_RECOMMENDATIONS[1261]).not.toHaveProperty("priceRange");
  });

  it("keeps FCX bronze floors separate", () => {
    expect(FCX_SBC_MIN_RATING_RECOMMENDATIONS).toEqual({ 5: 40, 1035: 40 });
    expect(FCX_SBC_RECOMMENDATIONS).not.toHaveProperty("5");
    expect(FCX_SBC_RECOMMENDATIONS).not.toHaveProperty("1035");
  });

  it("uses 47-82 for max-82 recommendations without a minimum", () => {
    const { own, inherited } = readers({
      "0:0": { ratingRange: [65, 93], priceRange: [null, null], commonOnly: false },
    });
    expect(resolveCandidateRules(1261, 1, inherited, own)).toMatchObject({
      ratingRange: [47, 82], priceRange: [null, null], commonOnly: true,
    });
    expect(resolveCandidateRules(1332, 1, inherited, own).ratingRange).toEqual([47, 82]);
  });

  it("applies explicit v48 minimums and preserves unknown defaults", () => {
    const { own, inherited } = readers({ "0:0": { ratingRange: [65, 93] } });
    expect(resolveCandidateRules(1017, 1, inherited, own).ratingRange).toEqual([73, 93]);
    expect(resolveCandidateRules(1039, 1, inherited, own).ratingRange).toEqual([75, 87]);
    expect(resolveCandidateRules(1333, 1, inherited, own).ratingRange).toEqual([75, 93]);
    expect(resolveCandidateRules(1355, 1, inherited, own).ratingRange).toEqual([75, 93]);
    expect(resolveCandidateRules(9999, 1, inherited, own).ratingRange).toEqual([65, 93]);
  });

  it("keeps special fuel rules disabled by default", () => {
    const { own, inherited } = readers({ "0:0": { ratingRange: [65, 93] } });
    const resolved = resolveCandidateRules(9999, 1, inherited, own);
    expect(resolved.specialFuelRulesEnabled).toBe(false);
    expect(resolved.specialFuelRatingRange).toEqual([0, 99]);
    expect(resolved.specialFuelPriceRange).toEqual([null, null]);
    expect(resolved.specialFuelOnlyStorage).toBe(false);
    expect(resolved.specialFuelStorageRulesEnabled).toBe(false);
    expect(resolved.specialFuelStorageRatingRange).toEqual([0, 99]);
    expect(resolved.sources.specialFuelRulesEnabled).toBe("global");
  });

  it("uses a 40 floor for both bronze SBCs while inheriting the ceiling", () => {
    const normal = readers({ "0:0": { ratingRange: [65, 93] } });
    expect(resolveCandidateRules(5, 16, normal.inherited, normal.own).ratingRange).toEqual([40, 93]);
    expect(resolveCandidateRules(1035, 3068, normal.inherited, normal.own).ratingRange).toEqual([40, 93]);
    const low = readers({ "0:0": { ratingRange: [20, 35] } });
    expect(resolveCandidateRules(1035, 1, low.inherited, low.own).ratingRange).toEqual([40, 40]);
  });

  it("lets saved set and challenge rules override recommendations", () => {
    const { own, inherited } = readers({
      "0:0": {
        ratingRange: [65, 93],
        priceRange: [null, null],
        squadRatingOvershoot: 0.8,
        commonOnly: false,
      },
      "1261:0": {
        ratingRange: [0, 99],
        priceRange: [null, null],
        squadRatingOvershoot: 2,
        commonOnly: false,
      },
      "1261:7": {
        squadRatingOvershoot: 0.1,
        allowExtraRequiredRarityGroupPlayers: true,
      },
    });
    const resolved = resolveCandidateRules(1261, 7, inherited, own);
    expect(resolved.ratingRange).toEqual([0, 99]);
    expect(resolved.commonOnly).toBe(false);
    expect(resolved.allowExtraRequiredRarityGroupPlayers).toBe(true);
    expect(resolved.squadRatingOvershoot).toBe(0.1);
    expect(resolved.sources.squadRatingOvershoot).toBe("challenge");
  });

  it("resolves special fuel fields through global, set, and challenge scopes", () => {
    const { own, inherited } = readers({
      "0:0": {
        ratingRange: [65, 93],
        specialFuelRulesEnabled: true,
        specialFuelRatingRange: [90, 99],
        specialFuelPriceRange: [null, 100_000],
        specialFuelOnlyStorage: false,
        specialFuelStorageRulesEnabled: true,
        specialFuelStorageRatingRange: [95, 97],
      },
      "888:0": {
        specialFuelRatingRange: [94, 99],
        specialFuelOnlyStorage: true,
        specialFuelStorageRatingRange: [96, 98],
      },
      "888:9": {
        specialFuelRulesEnabled: false,
        specialFuelPriceRange: [null, 50_000],
        specialFuelStorageRulesEnabled: false,
      },
    });
    const resolved = resolveCandidateRules(888, 9, inherited, own);
    expect(resolved.specialFuelRulesEnabled).toBe(false);
    expect(resolved.specialFuelRatingRange).toEqual([94, 99]);
    expect(resolved.specialFuelPriceRange).toEqual([null, 50_000]);
    expect(resolved.specialFuelOnlyStorage).toBe(true);
    expect(resolved.specialFuelStorageRulesEnabled).toBe(false);
    expect(resolved.specialFuelStorageRatingRange).toEqual([96, 98]);
    expect(resolved.sources.specialFuelRulesEnabled).toBe("challenge");
    expect(resolved.sources.specialFuelRatingRange).toBe("set");
    expect(resolved.sources.specialFuelPriceRange).toBe("challenge");
    expect(resolved.sources.specialFuelOnlyStorage).toBe("set");
    expect(resolved.sources.specialFuelStorageRulesEnabled).toBe("challenge");
    expect(resolved.sources.specialFuelStorageRatingRange).toBe("set");
  });

  it("normalizes special fuel rating and price ranges", () => {
    const { own, inherited } = readers({
      "0:0": {
        ratingRange: [65, 93],
        specialFuelRatingRange: [97, 93],
        specialFuelPriceRange: [10_000, 3_000],
        specialFuelStorageRatingRange: [96, 94],
      },
    });
    const resolved = resolveCandidateRules(9999, 1, inherited, own);
    expect(resolved.specialFuelRatingRange).toEqual([93, 93]);
    expect(resolved.specialFuelPriceRange).toEqual([3_000, 3_000]);
    expect(resolved.specialFuelStorageRatingRange).toEqual([94, 94]);
  });

  it("normalizes the squad-rating overshoot to 0-5 in tenths", () => {
    expect(normalizeSquadRatingOvershoot(undefined)).toBe(1.8);
    expect(normalizeSquadRatingOvershoot(-1)).toBe(0);
    expect(normalizeSquadRatingOvershoot(2.04)).toBe(2);
    expect(normalizeSquadRatingOvershoot(2.06)).toBe(2.1);
    expect(normalizeSquadRatingOvershoot(6)).toBe(5);
  });

  it("detects either price boundary", () => {
    expect(hasActivePriceRange([null, null])).toBe(false);
    expect(hasActivePriceRange([0, null])).toBe(true);
    expect(hasActivePriceRange([null, 25_000])).toBe(true);
  });
});
