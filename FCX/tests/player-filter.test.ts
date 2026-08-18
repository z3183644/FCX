import { describe, expect, it } from "vitest";
import {
  candidateHasActivePriceRange,
  isBackendCandidate,
  type CandidateExclusions,
  type CandidateFlags,
} from "../src/domain/sbc/player-filter";

const candidate: CandidateFlags = {
  loanCount: -1,
  sbcPrice: 1_000,
  marketPrice: 1_000,
  rating: 82,
  ratingRange: [40, 99],
  definitionId: 1,
  leagueId: 2,
  nationId: 3,
  teamId: 4,
  rarityLabel: "Gold Rare",
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
};

const exclusions: CandidateExclusions = {
  leagues: [],
  nations: [],
  teams: [],
  rarities: [],
  excludeSbcSquads: false,
  excludeSbc: false,
  excludeObjective: false,
  priceRange: [null, null],
  commonOnly: false,
  skipPriceRange: false,
  excludeTradable: false,
  excludeExtinct: false,
  onlyStorage: false,
  specialFuelRulesEnabled: false,
  specialFuelRatingRange: [0, 99],
  specialFuelPriceRange: [null, null],
  specialFuelOnlyStorage: false,
  specialFuelStorageRulesEnabled: false,
  specialFuelStorageRatingRange: [0, 99],
};

describe("backend player filtering", () => {
  it("accepts a normal eligible player", () => {
    expect(isBackendCandidate(candidate, exclusions)).toBe(true);
  });

  it("applies exclusions on the normal branch", () => {
    expect(
      isBackendCandidate(candidate, { ...exclusions, leagues: [2] }),
    ).toBe(false);
  });

  it("does not let duplicate or storage priority bypass rules", () => {
    expect(
      isBackendCandidate(
        {
          ...candidate,
          rating: 99,
          ratingRange: [40, 80],
        },
        { ...exclusions, leagues: [2] },
      ),
    ).toBe(false);
  });

  it("applies inclusive market price boundaries", () => {
    expect(isBackendCandidate(candidate, { ...exclusions, priceRange: [1_000, 1_000] })).toBe(true);
    expect(isBackendCandidate(candidate, { ...exclusions, priceRange: [1_001, null] })).toBe(false);
  });

  it("allows only rareflag zero when common-only is enabled", () => {
    expect(isBackendCandidate(candidate, { ...exclusions, commonOnly: true })).toBe(true);
    expect(isBackendCandidate({ ...candidate, rareflag: 1 }, { ...exclusions, commonOnly: true })).toBe(false);
    expect(isBackendCandidate({ ...candidate, rareflag: 2 }, { ...exclusions, commonOnly: true })).toBe(false);
  });

  it("applies the default 65-93 rating boundaries inclusively", () => {
    expect(isBackendCandidate({ ...candidate, rating: 64, ratingRange: [65, 93] }, exclusions)).toBe(false);
    expect(isBackendCandidate({ ...candidate, rating: 65, ratingRange: [65, 93] }, exclusions)).toBe(true);
    expect(isBackendCandidate({ ...candidate, rating: 93, ratingRange: [65, 93] }, exclusions)).toBe(true);
    expect(isBackendCandidate({ ...candidate, rating: 94, ratingRange: [65, 93] }, exclusions)).toBe(false);
  });

  it("lets required special fuel use its own rating range", () => {
    const rules = {
      ...exclusions,
      specialFuelRulesEnabled: true,
      specialFuelRatingRange: [93, 96] as [number, number],
    };
    expect(
      isBackendCandidate(
        { ...candidate, rating: 95, ratingRange: [65, 90], requiredSpecialFuel: true },
        rules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        { ...candidate, rating: 95, ratingRange: [65, 90], requiredSpecialFuel: false },
        rules,
      ),
    ).toBe(false);
  });

  it("ignores remembered special fuel fields while the feature is disabled", () => {
    const disabledRules = {
      ...exclusions,
      priceRange: [null, null] as [number | null, number | null],
      specialFuelRulesEnabled: false,
      specialFuelRatingRange: [95, 96] as [number, number],
      specialFuelPriceRange: [null, 500] as [number | null, number | null],
      specialFuelOnlyStorage: true,
      specialFuelStorageRulesEnabled: true,
      specialFuelStorageRatingRange: [97, 98] as [number, number],
    };
    expect(
      isBackendCandidate(
        {
          ...candidate,
          rating: 82,
          ratingRange: [80, 83],
          marketPrice: 1_000,
          requiredSpecialFuel: true,
          storage: false,
        },
        disabledRules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        {
          ...candidate,
          rating: 82,
          ratingRange: [80, 83],
          marketPrice: 1_000,
          requiredSpecialFuel: true,
          storage: false,
        },
        { ...disabledRules, priceRange: [null, 500] },
      ),
    ).toBe(false);
  });

  it("keeps the normal price range separate from special fuel price rules", () => {
    const rules = {
      ...exclusions,
      priceRange: [null, 5_000] as [number | null, number | null],
      specialFuelRulesEnabled: true,
      specialFuelPriceRange: [null, 100_000] as [number | null, number | null],
    };
    expect(
      isBackendCandidate(
        { ...candidate, marketPrice: 50_000, requiredSpecialFuel: true },
        rules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        { ...candidate, marketPrice: 50_000, requiredSpecialFuel: false },
        rules,
      ),
    ).toBe(false);
  });

  it("detects missing prices only for the candidate's active price branch", () => {
    const rules = {
      ...exclusions,
      priceRange: [null, null] as [number | null, number | null],
      specialFuelRulesEnabled: true,
      specialFuelPriceRange: [null, 5_000] as [number | null, number | null],
    };
    const normalCandidate = {
      ...candidate,
      marketPrice: null,
      requiredSpecialFuel: false,
    };
    const specialCandidate = {
      ...candidate,
      marketPrice: null,
      requiredSpecialFuel: true,
    };

    expect(candidateHasActivePriceRange(normalCandidate, rules)).toBe(false);
    expect(candidateHasActivePriceRange(specialCandidate, rules)).toBe(true);
    expect(isBackendCandidate(normalCandidate, rules)).toBe(true);
    expect(isBackendCandidate(specialCandidate, rules)).toBe(false);
    expect(
      isBackendCandidate(specialCandidate, {
        ...rules,
        skipPriceRange: true,
      }),
    ).toBe(true);
  });

  it("applies fuel storage-only only to required special fuel", () => {
    const rules = {
      ...exclusions,
      specialFuelRulesEnabled: true,
      specialFuelOnlyStorage: true,
    };
    expect(
      isBackendCandidate(
        { ...candidate, requiredSpecialFuel: true, storage: false },
        rules,
      ),
    ).toBe(false);
    expect(
      isBackendCandidate(
        { ...candidate, requiredSpecialFuel: true, storage: true },
        rules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        { ...candidate, requiredSpecialFuel: false, storage: false },
        rules,
      ),
    ).toBe(true);
  });

  it("allows a direct special range plus a storage-only extra range", () => {
    const rules = {
      ...exclusions,
      specialFuelRulesEnabled: true,
      specialFuelRatingRange: [87, 92] as [number, number],
      specialFuelStorageRulesEnabled: true,
      specialFuelStorageRatingRange: [95, 96] as [number, number],
    };
    expect(
      isBackendCandidate(
        { ...candidate, rating: 88, requiredSpecialFuel: true, storage: false },
        rules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        { ...candidate, rating: 95, requiredSpecialFuel: true, storage: false },
        rules,
      ),
    ).toBe(false);
    expect(
      isBackendCandidate(
        { ...candidate, rating: 95, requiredSpecialFuel: true, storage: true },
        rules,
      ),
    ).toBe(true);
    expect(
      isBackendCandidate(
        { ...candidate, rating: 93, requiredSpecialFuel: true, storage: true },
        rules,
      ),
    ).toBe(false);
  });
});
