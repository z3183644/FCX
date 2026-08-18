export interface CandidateFlags {
  loanCount: number;
  sbcPrice: number;
  marketPrice: number | null;
  rating: number;
  ratingRange: readonly [number, number];
  definitionId: number;
  leagueId: number | string;
  nationId: number | string;
  teamId: number | string;
  rarityLabel: string;
  isSbcPlayer: boolean;
  timeLimited: boolean;
  rewardFromSbc: boolean;
  rewardFromObjective: boolean;
  rareflag: number;
  tradeable: boolean;
  extinct: boolean;
  storage: boolean;
  substitute: boolean;
  requiredSpecialFuel: boolean;
}

export interface CandidateExclusions {
  leagues: ReadonlyArray<number | string>;
  nations: ReadonlyArray<number | string>;
  teams: ReadonlyArray<number | string>;
  rarities: readonly string[];
  excludeSbcSquads: boolean;
  excludeSbc: boolean;
  excludeObjective: boolean;
  priceRange: readonly [number | null, number | null];
  commonOnly: boolean;
  skipPriceRange: boolean;
  excludeTradable: boolean;
  excludeExtinct: boolean;
  onlyStorage: boolean;
  specialFuelRulesEnabled: boolean;
  specialFuelRatingRange: readonly [number, number];
  specialFuelPriceRange: readonly [number | null, number | null];
  specialFuelOnlyStorage: boolean;
  specialFuelStorageRulesEnabled: boolean;
  specialFuelStorageRatingRange: readonly [number, number];
}

const ratingInRange = (
  rating: number,
  range: readonly [number, number],
): boolean => rating >= range[0] && rating <= range[1];

const priceInRange = (
  marketPrice: number | null,
  range: readonly [number | null, number | null],
): boolean =>
  (range[0] === null || (marketPrice !== null && marketPrice >= range[0])) &&
  (range[1] === null || (marketPrice !== null && marketPrice <= range[1]));

export function candidateUsesSpecialFuelRules(
  player: CandidateFlags,
  exclusions: Pick<CandidateExclusions, "specialFuelRulesEnabled">,
): boolean {
  return exclusions.specialFuelRulesEnabled && player.requiredSpecialFuel;
}

export function candidatePriceRange(
  player: CandidateFlags,
  exclusions: Pick<
    CandidateExclusions,
    "priceRange" | "specialFuelRulesEnabled" | "specialFuelPriceRange"
  >,
): readonly [number | null, number | null] {
  return candidateUsesSpecialFuelRules(player, exclusions)
    ? exclusions.specialFuelPriceRange
    : exclusions.priceRange;
}

export function candidateHasActivePriceRange(
  player: CandidateFlags,
  exclusions: Pick<
    CandidateExclusions,
    "priceRange" | "specialFuelRulesEnabled" | "specialFuelPriceRange"
  >,
): boolean {
  const range = candidatePriceRange(player, exclusions);
  return range[0] !== null || range[1] !== null;
}

export function isBackendCandidate(
  player: CandidateFlags,
  exclusions: CandidateExclusions,
): boolean {
  const useSpecialFuelRules = candidateUsesSpecialFuelRules(player, exclusions);
  const priceRange = candidatePriceRange(player, exclusions);
  const passesRatingAndSource = useSpecialFuelRules
    ? (
      (
        ratingInRange(player.rating, exclusions.specialFuelRatingRange) &&
        (player.storage || !exclusions.specialFuelOnlyStorage)
      ) ||
      (
        exclusions.specialFuelStorageRulesEnabled &&
        player.storage &&
        ratingInRange(player.rating, exclusions.specialFuelStorageRatingRange)
      )
    )
    : ratingInRange(player.rating, player.ratingRange);

  return (
    player.loanCount < 0 &&
      player.sbcPrice < 100_000 &&
      passesRatingAndSource &&
      !exclusions.leagues.includes(player.leagueId) &&
      !exclusions.nations.includes(player.nationId) &&
      !exclusions.rarities.includes(player.rarityLabel) &&
      (!player.isSbcPlayer || !exclusions.excludeSbcSquads) &&
      !exclusions.teams.includes(player.teamId) &&
      !player.timeLimited &&
      !(player.rewardFromSbc && exclusions.excludeSbc) &&
      !(player.rewardFromObjective && exclusions.excludeObjective) &&
      (!exclusions.commonOnly || player.rareflag === 0) &&
      (exclusions.skipPriceRange || priceInRange(player.marketPrice, priceRange)) &&
      !(player.tradeable && exclusions.excludeTradable) &&
      !(player.extinct && exclusions.excludeExtinct) &&
      (player.storage || !exclusions.onlyStorage) &&
      !player.substitute
  );
}
