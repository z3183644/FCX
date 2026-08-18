import type { SettingKey, SolverSettings } from "../types/settings";
import {
  DEFAULT_RATING_RANGE,
  DEFAULT_SPECIAL_FUEL_RATING_RANGE,
} from "./default-settings";

export type RuleSource = "challenge" | "set" | "recommended" | "global";
export type PriceRange = [number | null, number | null];

export interface CandidateRuleSettings {
  ratingRange: [number, number];
  priceRange: PriceRange;
  squadRatingOvershoot: number;
  commonOnly: boolean;
  allowExtraRequiredRarityGroupPlayers: boolean;
  specialFuelRulesEnabled: boolean;
  specialFuelRatingRange: [number, number];
  specialFuelPriceRange: PriceRange;
  specialFuelOnlyStorage: boolean;
  specialFuelStorageRulesEnabled: boolean;
  specialFuelStorageRatingRange: [number, number];
}

export interface ResolvedCandidateRules extends CandidateRuleSettings {
  sources: Record<keyof CandidateRuleSettings, RuleSource>;
}

interface RecommendedCandidateRule {
  minRating?: number;
  maxRating?: number;
  priceRange?: PriceRange;
  commonOnly?: boolean;
}

export const FCX_SBC_RULE_SNAPSHOT_VERSION = 48;
export const FCX_SBC_RULE_SNAPSHOT_CAPTURED_AT = "2026-08-12";

/** FCX-owned, offline snapshot. It is never fetched while the userscript runs. */
export const FCX_SBC_RECOMMENDATIONS: Readonly<Record<number, RecommendedCandidateRule>> =
  Object.freeze({
    1017: { minRating: 73 },
    1038: { maxRating: 82, commonOnly: true },
    1039: { minRating: 75, maxRating: 87 },
    1254: { priceRange: [null, 25_000] },
    // FCX intentionally does not carry the external 3,000 price ceiling here.
    1261: { maxRating: 82, commonOnly: true },
    1298: { minRating: 79 },
    1308: { minRating: 77 },
    1310: { minRating: 73 },
    1316: { minRating: 78 },
    1317: { minRating: 79 },
    1319: { minRating: 77 },
    1320: { minRating: 73 },
    1321: { minRating: 77, maxRating: 91 },
    1322: { minRating: 78 },
    1323: { minRating: 73 },
    1324: { minRating: 80 },
    1326: { minRating: 78 },
    1327: { minRating: 80 },
    1328: { minRating: 80 },
    1332: { maxRating: 82 },
    1333: { minRating: 75 },
    1355: { minRating: 75 },
  });

export const FCX_SBC_MIN_RATING_RECOMMENDATIONS: Readonly<Record<number, number>> =
  Object.freeze({
    5: 40,
    1035: 40,
  });

const clampRating = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(99, Math.max(0, Math.round(parsed))) : fallback;
};

export const normalizeRatingRange = (value: unknown): [number, number] => {
  const input = Array.isArray(value) ? value : [];
  const min = clampRating(input[0], 0);
  const max = clampRating(input[1], 99);
  return min <= max ? [min, max] : [max, max];
};

const normalizePriceBound = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
};

export const normalizePriceRange = (value: unknown): PriceRange => {
  const input = Array.isArray(value) ? value : [];
  const min = normalizePriceBound(input[0]);
  const max = normalizePriceBound(input[1]);
  if (min !== null && max !== null && min > max) return [max, max];
  return [min, max];
};

export const hasActivePriceRange = (range: PriceRange): boolean =>
  range[0] !== null || range[1] !== null;

export const normalizeSquadRatingOvershoot = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1.8;
  return Math.round(Math.min(5, Math.max(0, parsed)) * 10) / 10;
};

type ValueReader = <K extends SettingKey>(
  setId: number | string,
  challengeId: number | string,
  key: K,
) => SolverSettings[K] | undefined;

const intersectPrices = (left: PriceRange, right?: PriceRange): PriceRange => {
  if (!right) return left;
  const mins = [left[0], right[0]].filter((item): item is number => item !== null);
  const maxes = [left[1], right[1]].filter((item): item is number => item !== null);
  const min = mins.length ? Math.max(...mins) : null;
  const max = maxes.length ? Math.min(...maxes) : null;
  return min !== null && max !== null && min > max ? [max, max] : [min, max];
};

function recommendedRatingRange(
  setId: number,
  globalRange: [number, number],
  rule?: RecommendedCandidateRule,
): [number, number] {
  const bronzeFloor = FCX_SBC_MIN_RATING_RECOMMENDATIONS[setId];
  if (bronzeFloor !== undefined) {
    return [bronzeFloor, Math.max(bronzeFloor, globalRange[1])];
  }
  if (!rule || (rule.minRating === undefined && rule.maxRating === undefined)) {
    return globalRange;
  }
  const minimum = rule.minRating ?? (rule.maxRating === 82 ? 47 : globalRange[0]);
  const maximum = rule.maxRating ?? globalRange[1];
  return normalizeRatingRange([minimum, Math.max(minimum, maximum)]);
}

export function resolveCandidateRules(
  setId: number,
  challengeId: number,
  readValue: ValueReader,
  readOwnValue: ValueReader,
): ResolvedCandidateRules {
  const globalRules: CandidateRuleSettings = {
    ratingRange: normalizeRatingRange(readValue(0, 0, "ratingRange") ?? DEFAULT_RATING_RANGE),
    priceRange: normalizePriceRange(readValue(0, 0, "priceRange")),
    squadRatingOvershoot: normalizeSquadRatingOvershoot(
      readValue(0, 0, "squadRatingOvershoot") ?? 1.8,
    ),
    commonOnly: readValue(0, 0, "commonOnly") === true,
    allowExtraRequiredRarityGroupPlayers:
      readValue(0, 0, "allowExtraRequiredRarityGroupPlayers") === true,
    specialFuelRulesEnabled:
      readValue(0, 0, "specialFuelRulesEnabled") === true,
    specialFuelRatingRange: normalizeRatingRange(
      readValue(0, 0, "specialFuelRatingRange") ?? DEFAULT_SPECIAL_FUEL_RATING_RANGE,
    ),
    specialFuelPriceRange: normalizePriceRange(
      readValue(0, 0, "specialFuelPriceRange"),
    ),
    specialFuelOnlyStorage: readValue(0, 0, "specialFuelOnlyStorage") === true,
    specialFuelStorageRulesEnabled:
      readValue(0, 0, "specialFuelStorageRulesEnabled") === true,
    specialFuelStorageRatingRange: normalizeRatingRange(
      readValue(0, 0, "specialFuelStorageRatingRange") ?? DEFAULT_SPECIAL_FUEL_RATING_RANGE,
    ),
  };
  const recommended = FCX_SBC_RECOMMENDATIONS[Number(setId)];
  const recommendedRating = recommendedRatingRange(Number(setId), globalRules.ratingRange, recommended);
  const recommendedPrice = intersectPrices(globalRules.priceRange, recommended?.priceRange);
  const hasRatingRecommendation = Boolean(
    recommended?.minRating !== undefined
    || recommended?.maxRating !== undefined
    || FCX_SBC_MIN_RATING_RECOMMENDATIONS[Number(setId)] !== undefined,
  );
  const result: ResolvedCandidateRules = {
    ratingRange: recommendedRating,
    priceRange: recommendedPrice,
    squadRatingOvershoot: globalRules.squadRatingOvershoot,
    commonOnly: globalRules.commonOnly || recommended?.commonOnly === true,
    allowExtraRequiredRarityGroupPlayers:
      globalRules.allowExtraRequiredRarityGroupPlayers,
    specialFuelRulesEnabled: globalRules.specialFuelRulesEnabled,
    specialFuelRatingRange: globalRules.specialFuelRatingRange,
    specialFuelPriceRange: globalRules.specialFuelPriceRange,
    specialFuelOnlyStorage: globalRules.specialFuelOnlyStorage,
    specialFuelStorageRulesEnabled: globalRules.specialFuelStorageRulesEnabled,
    specialFuelStorageRatingRange: globalRules.specialFuelStorageRatingRange,
    sources: {
      ratingRange: hasRatingRecommendation ? "recommended" : "global",
      priceRange: recommended?.priceRange ? "recommended" : "global",
      squadRatingOvershoot: "global",
      commonOnly: recommended?.commonOnly === true && !globalRules.commonOnly ? "recommended" : "global",
      allowExtraRequiredRarityGroupPlayers: "global",
      specialFuelRulesEnabled: "global",
      specialFuelRatingRange: "global",
      specialFuelPriceRange: "global",
      specialFuelOnlyStorage: "global",
      specialFuelStorageRulesEnabled: "global",
      specialFuelStorageRatingRange: "global",
    },
  };
  const applyScope = (scopeSet: number, scopeChallenge: number, source: RuleSource) => {
    for (const key of [
      "ratingRange",
      "priceRange",
      "squadRatingOvershoot",
      "commonOnly",
      "allowExtraRequiredRarityGroupPlayers",
      "specialFuelRulesEnabled",
      "specialFuelRatingRange",
      "specialFuelPriceRange",
      "specialFuelOnlyStorage",
      "specialFuelStorageRulesEnabled",
      "specialFuelStorageRatingRange",
    ] as const) {
      const value = readOwnValue(scopeSet, scopeChallenge, key);
      if (value === undefined) continue;
      if (key === "ratingRange") result.ratingRange = normalizeRatingRange(value);
      else if (key === "priceRange") result.priceRange = normalizePriceRange(value);
      else if (key === "specialFuelRatingRange") {
        result.specialFuelRatingRange = normalizeRatingRange(value);
      }
      else if (key === "specialFuelPriceRange") {
        result.specialFuelPriceRange = normalizePriceRange(value);
      }
      else if (key === "specialFuelStorageRatingRange") {
        result.specialFuelStorageRatingRange = normalizeRatingRange(value);
      }
      else if (key === "squadRatingOvershoot") {
        result.squadRatingOvershoot = normalizeSquadRatingOvershoot(value);
      }
      else result[key] = value === true;
      result.sources[key] = source;
    }
  };
  if (Number(setId) !== 0) applyScope(setId, 0, "set");
  if (Number(challengeId) !== 0) applyScope(setId, challengeId, "challenge");
  return result;
}
