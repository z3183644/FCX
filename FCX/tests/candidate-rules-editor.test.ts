// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  candidateRuleStandaloneSaveChallengeId,
  createCandidateRulesEditor,
} from "../src/ui/candidate-rules-editor";

describe("candidate rules editor", () => {
  beforeEach(() => document.body.replaceChildren());

  it("hides internal rule sources and explains missing prices in the label", () => {
    const editor = createCandidateRulesEditor({
      value: {
        ratingRange: [0, 82],
        priceRange: [null, 3000],
        squadRatingOvershoot: 0.8,
        commonOnly: true,
        allowExtraRequiredRarityGroupPlayers: false,
        specialFuelRulesEnabled: false,
        specialFuelRatingRange: [0, 99],
        specialFuelPriceRange: [null, null],
        specialFuelOnlyStorage: false,
        specialFuelStorageRulesEnabled: false,
        specialFuelStorageRatingRange: [0, 99],
        sources: {
          ratingRange: "recommended",
          priceRange: "recommended",
          squadRatingOvershoot: "global",
          commonOnly: "recommended",
          allowExtraRequiredRarityGroupPlayers: "global",
          specialFuelRulesEnabled: "global",
          specialFuelRatingRange: "global",
          specialFuelPriceRange: "global",
          specialFuelOnlyStorage: "global",
          specialFuelStorageRulesEnabled: "global",
          specialFuelStorageRatingRange: "global",
        },
      },
    });
    document.body.appendChild(editor.element);
    expect(editor.element.textContent).toContain("球员价格范围（读不到价格时不要设置）");
    expect(editor.element.textContent).not.toContain("来源：");
    expect(editor.element.querySelector(".fcx-candidate-rules__source")).toBeNull();
    expect(
      [...editor.element.querySelectorAll<HTMLInputElement>('.fcx-candidate-rules__range input')]
        .every((input) => input.inputMode === "numeric"),
    ).toBe(true);
    expect(
      editor.element.querySelector<HTMLInputElement>('.fcx-candidate-rules__number input')
        ?.inputMode,
    ).toBe("decimal");
    const specialDetails = editor.element.querySelector<HTMLElement>(
      ".fcx-candidate-rules__details",
    );
    expect(specialDetails?.hidden).toBe(true);
    expect(specialDetails?.getAttribute("aria-hidden")).toBe("true");
  });

  it("captures numeric edits on input before a save button is clicked", () => {
    const editor = createCandidateRulesEditor({
      value: {
        ratingRange: [65, 93],
        priceRange: [null, null],
        squadRatingOvershoot: 0.8,
        commonOnly: false,
        allowExtraRequiredRarityGroupPlayers: false,
        specialFuelRulesEnabled: false,
        specialFuelRatingRange: [0, 99],
        specialFuelPriceRange: [null, null],
        specialFuelOnlyStorage: false,
        specialFuelStorageRulesEnabled: false,
        specialFuelStorageRatingRange: [0, 99],
        sources: {
          ratingRange: "global",
          priceRange: "global",
          squadRatingOvershoot: "global",
          commonOnly: "global",
          allowExtraRequiredRarityGroupPlayers: "global",
          specialFuelRulesEnabled: "global",
          specialFuelRatingRange: "global",
          specialFuelPriceRange: "global",
          specialFuelOnlyStorage: "global",
          specialFuelStorageRulesEnabled: "global",
          specialFuelStorageRatingRange: "global",
        },
      },
    });
    document.body.appendChild(editor.element);
    const inputs = editor.element.querySelectorAll<HTMLInputElement>(
      '.fcx-candidate-rules__range input',
    );
    const ratingMinimum = inputs.item(0);
    const priceMaximum = inputs.item(3);
    expect(ratingMinimum).toBeTruthy();
    expect(priceMaximum).toBeTruthy();
    ratingMinimum.value = "72";
    ratingMinimum.dispatchEvent(new Event("input", { bubbles: true }));
    expect(editor.getValue().ratingRange).toEqual([72, 93]);
    expect(editor.changedKeys()).toContain("ratingRange");

    priceMaximum.value = "5000";
    priceMaximum.dispatchEvent(new Event("input", { bubbles: true }));
    expect(editor.getValue().priceRange).toEqual([null, 5000]);
    expect(editor.changedKeys()).toContain("priceRange");

    const overshoot = editor.element.querySelector<HTMLInputElement>(
      '.fcx-candidate-rules__number input',
    )!;
    overshoot.value = "2.04";
    overshoot.dispatchEvent(new Event("input", { bubbles: true }));
    expect(editor.getValue().squadRatingOvershoot).toBe(2);
    expect(editor.changedKeys()).toContain("squadRatingOvershoot");
  });

  it("reads the live numeric field value even when the browser has not emitted change", () => {
    const editor = createCandidateRulesEditor({
      value: {
        ratingRange: [65, 93],
        priceRange: [null, null],
        squadRatingOvershoot: 0.8,
        commonOnly: false,
        allowExtraRequiredRarityGroupPlayers: false,
        specialFuelRulesEnabled: false,
        specialFuelRatingRange: [0, 99],
        specialFuelPriceRange: [null, null],
        specialFuelOnlyStorage: false,
        specialFuelStorageRulesEnabled: false,
        specialFuelStorageRatingRange: [0, 99],
        sources: {
          ratingRange: "global",
          priceRange: "global",
          squadRatingOvershoot: "global",
          commonOnly: "global",
          allowExtraRequiredRarityGroupPlayers: "global",
          specialFuelRulesEnabled: "global",
          specialFuelRatingRange: "global",
          specialFuelPriceRange: "global",
          specialFuelOnlyStorage: "global",
          specialFuelStorageRulesEnabled: "global",
          specialFuelStorageRatingRange: "global",
        },
      },
    });
    document.body.appendChild(editor.element);
    const ratingMaximum = editor.element.querySelectorAll<HTMLInputElement>(
      '.fcx-candidate-rules__range input',
    ).item(1);
    ratingMaximum.value = "88";
    expect(editor.getValue().ratingRange).toEqual([65, 88]);
    expect(editor.changedKeys()).toContain("ratingRange");
  });

  it("captures special fuel controls", () => {
    const editor = createCandidateRulesEditor({
      value: {
        ratingRange: [65, 90],
        priceRange: [null, null],
        squadRatingOvershoot: 0.8,
        commonOnly: false,
        allowExtraRequiredRarityGroupPlayers: false,
        specialFuelRulesEnabled: false,
        specialFuelRatingRange: [91, 99],
        specialFuelPriceRange: [null, null],
        specialFuelOnlyStorage: false,
        specialFuelStorageRulesEnabled: false,
        specialFuelStorageRatingRange: [0, 99],
        sources: {
          ratingRange: "global",
          priceRange: "global",
          squadRatingOvershoot: "global",
          commonOnly: "global",
          allowExtraRequiredRarityGroupPlayers: "global",
          specialFuelRulesEnabled: "global",
          specialFuelRatingRange: "global",
          specialFuelPriceRange: "global",
          specialFuelOnlyStorage: "global",
          specialFuelStorageRulesEnabled: "global",
          specialFuelStorageRatingRange: "global",
        },
      },
    });
    document.body.appendChild(editor.element);
    const specialDetails = editor.element.querySelector<HTMLElement>(
      ".fcx-candidate-rules__details",
    )!;
    expect(specialDetails.hidden).toBe(true);

    const fuelToggle = editor.element.querySelector<HTMLInputElement>(
      'input[aria-label="启用特殊献祭卡规则"]',
    )!;
    fuelToggle.checked = true;
    fuelToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.getValue().specialFuelRulesEnabled).toBe(true);
    expect(editor.changedKeys()).toContain("specialFuelRulesEnabled");
    expect(specialDetails.hidden).toBe(false);
    expect(specialDetails.getAttribute("aria-hidden")).toBe("false");

    const inputs = editor.element.querySelectorAll<HTMLInputElement>(
      '.fcx-candidate-rules__range input',
    );
    const fuelRatingMinimum = inputs.item(4);
    const fuelPriceMaximum = inputs.item(7);
    fuelRatingMinimum.value = "95";
    fuelRatingMinimum.dispatchEvent(new Event("input", { bubbles: true }));
    fuelPriceMaximum.value = "75000";
    fuelPriceMaximum.dispatchEvent(new Event("input", { bubbles: true }));
    expect(editor.getValue().specialFuelRatingRange).toEqual([95, 99]);
    expect(editor.getValue().specialFuelPriceRange).toEqual([null, 75_000]);
    expect(editor.changedKeys()).toContain("specialFuelRatingRange");
    expect(editor.changedKeys()).toContain("specialFuelPriceRange");

    const storageToggle = editor.element.querySelector<HTMLInputElement>(
      'input[aria-label="直接范围只用 SBC 仓库"]',
    )!;
    storageToggle.checked = true;
    storageToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.getValue().specialFuelOnlyStorage).toBe(true);
    expect(editor.changedKeys()).toContain("specialFuelOnlyStorage");

    const storageExtraToggle = editor.element.querySelector<HTMLInputElement>(
      'input[aria-label="启用 SBC 仓库额外范围"]',
    )!;
    storageExtraToggle.checked = true;
    storageExtraToggle.dispatchEvent(new Event("change", { bubbles: true }));
    const storageRatingMinimum = inputs.item(8);
    const storageRatingMaximum = inputs.item(9);
    storageRatingMinimum.value = "95";
    storageRatingMinimum.dispatchEvent(new Event("input", { bubbles: true }));
    storageRatingMaximum.value = "96";
    storageRatingMaximum.dispatchEvent(new Event("input", { bubbles: true }));
    expect(editor.getValue().specialFuelStorageRulesEnabled).toBe(true);
    expect(editor.getValue().specialFuelStorageRatingRange).toEqual([95, 96]);
    expect(editor.changedKeys()).toContain("specialFuelStorageRulesEnabled");
    expect(editor.changedKeys()).toContain("specialFuelStorageRatingRange");
  });

  it("saves a single-challenge SBC to its challenge scope and a set to group scope", () => {
    expect(candidateRuleStandaloneSaveChallengeId(false, 3771)).toBe(3771);
    expect(candidateRuleStandaloneSaveChallengeId(true, 3771)).toBe(0);
  });
});
