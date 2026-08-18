import { describe, expect, it } from "vitest";
import { SettingsStore, type StorageAdapter } from "../src/state/settings-store";
import { defaultSolverSettings } from "../src/config/default-settings";
import type { SolverSettings } from "../src/types/settings";

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("storage unavailable");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("SettingsStore", () => {
  it("uses safe defaults for automatic pack processing", () => {
    expect(defaultSolverSettings.animateWalkouts).toBe(98);
    expect(defaultSolverSettings.maxSolveTime).toBe(10);
    expect(defaultSolverSettings.squadRatingOvershoot).toBe(1.8);
    expect(defaultSolverSettings.eaRequestMaxAttempts).toBe(3);
    expect(defaultSolverSettings.eaRequestRetryDelaySeconds).toBe(3);
    expect(defaultSolverSettings.eaSbcRequestIntervalMs).toBe(900);
    expect(defaultSolverSettings.autoSubmit).toBe(1);
    expect(defaultSolverSettings.showPrices).toBe(true);
    expect(defaultSolverSettings.showSbcTab).toBe(true);
    expect(defaultSolverSettings.sbcAllGroup).toBe(true);
    expect(defaultSolverSettings.useDupes).toBe(true);
    expect(defaultSolverSettings.packAutoPick).toBe(true);
    expect(defaultSolverSettings.packPickStrategy).toBe("ovr");
    expect(defaultSolverSettings.packQuickSellDuplicates).toBe(true);
    expect(defaultSolverSettings.packQuickSellUnder).toBe(80);
    expect(defaultSolverSettings.packSkipAnimation).toBe(true);
    expect(defaultSolverSettings.duplicateDiscount).toBe(50);
    expect(defaultSolverSettings.untradeableDiscount).toBe(80);
    expect(defaultSolverSettings.submitHourLimit).toBe(90);
    expect(defaultSolverSettings.submitDayLimit).toBe(300);
    expect(defaultSolverSettings.ratingRange).toEqual([65, 93]);
    expect(defaultSolverSettings.priceRange).toEqual([null, null]);
    expect(defaultSolverSettings.commonOnly).toBe(false);
    expect(defaultSolverSettings.allowExtraRequiredRarityGroupPlayers).toBe(false);
    expect(defaultSolverSettings.specialFuelRulesEnabled).toBe(false);
    expect(defaultSolverSettings.specialFuelRatingRange).toEqual([0, 99]);
    expect(defaultSolverSettings.specialFuelPriceRange).toEqual([null, null]);
    expect(defaultSolverSettings.specialFuelOnlyStorage).toBe(false);
    expect(defaultSolverSettings.specialFuelStorageRulesEnabled).toBe(false);
    expect(defaultSolverSettings.specialFuelStorageRatingRange).toEqual([0, 99]);
    expect(defaultSolverSettings).not.toHaveProperty("excludeSpecial");
    expect(defaultSolverSettings).not.toHaveProperty("saveTotw");
    expect(defaultSolverSettings).not.toHaveProperty("repeatCount");
    expect(defaultSolverSettings).not.toHaveProperty(["play", "Sounds"].join(""));
  });

  it("removes the obsolete repeatCount field from every legacy scope", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "sbcSolverSettings",
      JSON.stringify({
        sbcSettings: {
          0: { 0: { repeatCount: -1 } },
          12: { 34: { repeatCount: 5, maxSolveTime: 30 } },
        },
      }),
    );
    const store = new SettingsStore(storage);
    expect(store.removeLegacyRepeatCount()).toBe(true);
    expect(storage.getItem("sbcSolverSettings")).not.toContain("repeatCount");
    expect(store.getValue(12, 34, "maxSolveTime")).toBe(30);
  });

  it("removes retired UI settings and scoped concept multipliers", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { conceptPremium: 10, showLogOverlay: true, [["play", "Sounds"].join("")]: true } },
      12: { 0: { conceptPremium: 20, [["play", "Sounds"].join("")]: false }, 34: { conceptPremium: 30 } },
    } }));
    const store = new SettingsStore(storage);
    expect(store.removeLegacyUiSettings()).toBe(true);
    const serialized = storage.getItem("sbcSolverSettings") ?? "";
    expect(serialized).not.toContain("showLogOverlay");
    expect(serialized).not.toContain(["play", "Sounds"].join(""));
    expect(store.getValue(0, 0, "conceptPremium")).toBe(10);
    expect(store.getDocument().sbcSettings?.["12"]?.["0"]).not.toHaveProperty("conceptPremium");
  });

  it("retires login automation without changing other scoped rules", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      12: {
        0: { sbcOnLogin: true, ratingRange: [65, 82] },
        34: { sbcOnLogin: false },
      },
      13: { 35: { sbcOnLogin: true, maxSolveTime: 20 } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.removeRetiredStartupSbcSettings()).toBe(true);
    expect(store.removeRetiredStartupSbcSettings()).toBe(false);
    expect(storage.getItem("sbcSolverSettings")).not.toContain("sbcOnLogin");
    expect(store.getOwnValue(12, 0, "ratingRange")).toEqual([65, 82]);
    expect(store.getOwnValue(13, 35, "maxSolveTime")).toBe(20);
    expect(store.getDocument().sbcSettings?.["12"]?.["34"]).toBeUndefined();
    expect(store.getDocument().startupSbcRetirementVersion).toBe(1);
  });

  it("preserves challenge -> SBC -> global setting precedence", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);

    store.saveValue(0, 0, "maxSolveTime", 60);
    store.saveValue(10, 0, "maxSolveTime", 90);
    store.saveValue(10, 20, "maxSolveTime", 120);

    expect(store.getValue(10, 20, "maxSolveTime")).toBe(120);
    expect(store.getValue(10, 21, "maxSolveTime")).toBe(90);
    expect(store.getValue(11, 21, "maxSolveTime")).toBe(60);
    expect(storage.values.has("sbcSolverSettings")).toBe(true);
  });

  it("keeps existing explicit values while filling missing defaults", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.saveValue(0, 0, "packQuickSellDuplicates", false);
    store.saveValue(0, 0, "packQuickSellUnder", 72);
    store.saveValue(0, 0, "packSkipAnimation", false);
    store.saveValue(0, 0, "autoSubmit", 0);

    for (const [key, fallback] of Object.entries(defaultSolverSettings)) {
      const setting = key as keyof SolverSettings;
      store.saveValue(0, 0, setting, store.getValue(0, 0, setting) ?? fallback);
    }

    expect(store.getValue(0, 0, "packQuickSellDuplicates")).toBe(false);
    expect(store.getValue(0, 0, "packQuickSellUnder")).toBe(72);
    expect(store.getValue(0, 0, "packSkipAnimation")).toBe(false);
    expect(store.getValue(0, 0, "autoSubmit")).toBe(0);
  });

  it("uses always-submit only when the stored field is missing", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);

    for (const [key, fallback] of Object.entries(defaultSolverSettings)) {
      const setting = key as keyof SolverSettings;
      store.saveValue(0, 0, setting, store.getValue(0, 0, setting) ?? fallback);
    }

    expect(store.getValue(0, 0, "autoSubmit")).toBe(1);

    const existing = new SettingsStore(new MemoryStorage());
    existing.saveValue(0, 0, "autoSubmit", 4);
    for (const [key, fallback] of Object.entries(defaultSolverSettings)) {
      const setting = key as keyof SolverSettings;
      existing.saveValue(0, 0, setting, existing.getValue(0, 0, setting) ?? fallback);
    }
    expect(existing.getValue(0, 0, "autoSubmit")).toBe(4);
  });

  it("rolls the in-memory cache back when persistence fails", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.saveValue(0, 0, "maxSolveTime", 60);
    storage.failWrites = true;

    expect(() => store.saveValue(0, 0, "maxSolveTime", 30)).toThrow(
      "storage unavailable",
    );
    expect(store.getValue(0, 0, "maxSolveTime")).toBe(60);
  });

  it("migrates legacy maxRating into the upper ratingRange value", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "sbcSolverSettings",
      JSON.stringify({
        sbcSettings: {
          12: { 34: { ratingRange: [40, 99], maxRating: 88 } },
        },
      }),
    );
    const store = new SettingsStore(storage);

    expect(store.migrateMaxRating()).toBe(true);
    expect(store.getValue(12, 34, "ratingRange")).toEqual([40, 88]);
    expect(storage.getItem("sbcSolverSettings")).not.toContain("maxRating");
  });

  it("migrates only the old global default rating range once", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { ratingRange: [0, 99] } },
      1038: { 0: { ratingRange: [0, 99] }, 7: { ratingRange: [60, 82] } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateDefaultRatingRange()).toBe(true);
    expect(store.migrateDefaultRatingRange()).toBe(false);
    expect(store.getValue(0, 0, "ratingRange")).toEqual([65, 93]);
    expect(store.getOwnValue(1038, 0, "ratingRange")).toEqual([0, 99]);
    expect(store.getOwnValue(1038, 7, "ratingRange")).toEqual([60, 82]);
    expect(store.getDocument().ratingRangeDefaultsMigrationVersion).toBe(1);
  });

  it("preserves a custom global rating range during the default migration", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { ratingRange: [70, 90] } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateDefaultRatingRange()).toBe(true);
    expect(store.getValue(0, 0, "ratingRange")).toEqual([70, 90]);
    expect(store.getDocument().ratingRangeDefaultsMigrationVersion).toBe(1);
  });

  it("migrates the old global squad-rating overshoot default once", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { squadRatingOvershoot: 0.8 } },
      1017: { 0: { squadRatingOvershoot: 0.8 } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateDefaultSquadRatingOvershoot()).toBe(true);
    expect(store.migrateDefaultSquadRatingOvershoot()).toBe(false);
    expect(store.getOwnValue(0, 0, "squadRatingOvershoot")).toBe(1.8);
    expect(store.getOwnValue(1017, 0, "squadRatingOvershoot")).toBe(0.8);
    expect(store.getDocument().squadRatingOvershootDefaultsMigrationVersion).toBe(1);
  });

  it("preserves a custom global squad-rating overshoot during migration", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { squadRatingOvershoot: 2.4 } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateDefaultSquadRatingOvershoot()).toBe(true);
    expect(store.getValue(0, 0, "squadRatingOvershoot")).toBe(2.4);
  });

  it("clears retired special-card settings exactly once without touching other rules", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: {
        0: {
          excludeSpecial: true,
          saveTotw: true,
          allowRarityGroupLegacy: true,
          ratingRange: [70, 90],
        },
      },
      12: { 34: { excludeSpecial: false, saveTotw: false, maxSolveTime: 30 } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateFcxCandidateRules()).toBe(true);
    expect(store.migrateFcxCandidateRules()).toBe(false);
    const serialized = storage.getItem("sbcSolverSettings") ?? "";
    expect(serialized).not.toContain("excludeSpecial");
    expect(serialized).not.toContain("saveTotw");
    expect(serialized).not.toContain("allowRarityGroupLegacy");
    expect(store.getValue(0, 0, "allowExtraRequiredRarityGroupPlayers")).toBe(true);
    expect(store.getValue(0, 0, "ratingRange")).toEqual([70, 90]);
    expect(store.getValue(12, 34, "maxSolveTime")).toBe(30);
    expect(store.getDocument().fcxCandidateRulesMigrationVersion).toBe(1);
  });

  it("does not enable special fuel rules while migrating legacy candidate settings", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { ratingRange: [70, 90], excludeSpecial: true } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateFcxCandidateRules()).toBe(true);
    expect(store.getValue(0, 0, "ratingRange")).toEqual([70, 90]);
    expect(store.getValue(0, 0, "specialFuelRulesEnabled")).toBeUndefined();
    expect(store.getValue(0, 0, "specialFuelRatingRange")).toBeUndefined();
    expect(store.getValue(0, 0, "specialFuelStorageRulesEnabled")).toBeUndefined();
    expect(storage.getItem("sbcSolverSettings")).not.toContain("specialFuel");
  });

  it("migrates the legacy local API URL into a validated backend port", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { apiUrl: "http://127.0.0.1:9123" } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateBackendPort()).toBe(true);
    expect(store.getValue(0, 0, "backendPort")).toBe(9123);
    expect(store.migrateBackendPort()).toBe(false);
  });

  it("falls back to port 8000 for unsafe legacy endpoints", () => {
    const storage = new MemoryStorage();
    storage.setItem("sbcSolverSettings", JSON.stringify({ sbcSettings: {
      0: { 0: { apiUrl: "https://example.com:9123", backendPort: 80 } },
    } }));
    const store = new SettingsStore(storage);

    expect(store.migrateBackendPort()).toBe(true);
    expect(store.getValue(0, 0, "backendPort")).toBe(8000);
  });
});
