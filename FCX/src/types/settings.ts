export interface SolverSettings {
  apiUrl: string;
  backendPort: number;
  eaRequestMaxAttempts: number;
  eaRequestRetryDelaySeconds: number;
  eaSbcRequestIntervalMs: number;
  excludeTeams: number[];
  excludeRarity: string[];
  excludeNations: number[];
  excludeLeagues: number[];
  excludeSbc: boolean;
  excludeTradable: boolean;
  excludeObjective: boolean;
  excludeExtinct: boolean;
  excludeSbcSquads: boolean;
  onlyStorage: boolean;
  useConcepts: boolean;
  collectConcepts: boolean;
  animateWalkouts: number;
  autoSubmit: number;
  maxSolveTime: number;
  squadRatingOvershoot: number;
  priceCacheMinutes: number;
  ratingRange: [number, number];
  priceRange: [number | null, number | null];
  commonOnly: boolean;
  allowExtraRequiredRarityGroupPlayers: boolean;
  specialFuelRulesEnabled: boolean;
  specialFuelRatingRange: [number, number];
  specialFuelPriceRange: [number | null, number | null];
  specialFuelOnlyStorage: boolean;
  specialFuelStorageRulesEnabled: boolean;
  specialFuelStorageRatingRange: [number, number];
  showPrices: boolean;
  showSbcTab: boolean;
  useDupes: boolean;
  autoOpenPacks: boolean;
  packAutoPick: boolean;
  packPickStrategy: "ovr" | "price";
  packQuickSellDuplicates: boolean;
  packQuickSellUnder: number;
  packSkipAnimation: boolean;
  sbcType: string;
  duplicateDiscount: number;
  untradeableDiscount: number;
  conceptPremium: number;
  evoPremium: number;
  ratingUI: boolean;
  sbcAllGroup: boolean;
  submitHourLimit: number;
  submitDayLimit: number;
}

export type SettingKey = keyof SolverSettings;
export type ScopedSettings = Partial<SolverSettings> & {
  maxRating?: number;
  repeatCount?: number;
  showLogOverlay?: boolean;
};

export interface SettingsDocument {
  sbcSettings?: Record<string, Record<string, ScopedSettings>>;
  fcxCandidateRulesMigrationVersion?: number;
  ratingRangeDefaultsMigrationVersion?: number;
  squadRatingOvershootDefaultsMigrationVersion?: number;
  startupSbcRetirementVersion?: number;
  [section: string]: unknown;
}
