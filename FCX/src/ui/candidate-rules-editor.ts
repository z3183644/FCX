import type { CandidateRuleSettings, ResolvedCandidateRules } from "../config/fcx-sbc-recommendations";

export type CandidateRuleKey = keyof CandidateRuleSettings;
type CandidateRangeRuleKey =
  | "ratingRange"
  | "priceRange"
  | "specialFuelRatingRange"
  | "specialFuelPriceRange"
  | "specialFuelStorageRatingRange";
type CandidateToggleRuleKey =
  | "commonOnly"
  | "allowExtraRequiredRarityGroupPlayers"
  | "specialFuelRulesEnabled"
  | "specialFuelOnlyStorage"
  | "specialFuelStorageRulesEnabled";

export interface CandidateRulesEditorOptions {
  value: ResolvedCandidateRules;
  documentRef?: Document;
  onChange?: (key: CandidateRuleKey, value: CandidateRuleSettings[CandidateRuleKey]) => void;
  onRestore?: () => ResolvedCandidateRules | void;
}

export interface CandidateRulesEditorHandle {
  element: HTMLElement;
  getValue(): CandidateRuleSettings;
  changedKeys(): ReadonlySet<CandidateRuleKey>;
  restored(): boolean;
}

export const candidateRuleStandaloneSaveChallengeId = (
  supportsWholeSetAction: boolean,
  selectedChallengeId: unknown,
): number => supportsWholeSetAction
  ? 0
  : Math.max(0, Math.trunc(Number(selectedChallengeId) || 0));

export function createCandidateRulesEditor(options: CandidateRulesEditorOptions): CandidateRulesEditorHandle {
  const documentRef = options.documentRef ?? document;
  let current = structuredClone(options.value);
  let restored = false;
  const changed = new Set<CandidateRuleKey>();
  const renderers: Array<() => void> = [];
  const synchronizers: Array<() => void> = [];
  const root = documentRef.createElement("section");
  root.className = "fcx-candidate-rules";
  const heading = documentRef.createElement("div");
  heading.className = "fcx-candidate-rules__heading";
  heading.innerHTML = "<strong>球员使用范围</strong><small>总评、未折扣市场价与特殊分组保护</small>";
  const restore = documentRef.createElement("button");
  restore.type = "button";
  restore.className = "fcx-candidate-rules__restore";
  restore.textContent = "恢复推荐值";
  heading.appendChild(restore);
  const grid = documentRef.createElement("div");
  grid.className = "fcx-candidate-rules__grid";

  const appendRuleRow = <T extends HTMLElement>(
    row: T,
    parent: HTMLElement = grid,
  ): T => {
    parent.appendChild(row);
    return row;
  };

  const subheading = (
    title: string,
    help: string,
    parent: HTMLElement = grid,
  ) => {
    const row = documentRef.createElement("div");
    row.className = "fcx-candidate-rules__subheading";
    const strong = documentRef.createElement("strong");
    strong.textContent = title;
    const small = documentRef.createElement("small");
    small.textContent = help;
    row.append(strong, small);
    appendRuleRow(row, parent);
  };

  const numericPair = (
    label: string,
    key: CandidateRangeRuleKey,
    min: number,
    max: number,
    nullable: boolean,
    parent: HTMLElement = grid,
  ) => {
    const row = documentRef.createElement("label");
    row.className = "fcx-candidate-rules__field";
    const title = documentRef.createElement("span");
    title.textContent = label;
    const controls = documentRef.createElement("span");
    controls.className = "fcx-candidate-rules__range";
    const low = documentRef.createElement("input");
    const high = documentRef.createElement("input");
    for (const input of [low, high]) {
      input.type = "number";
      input.inputMode = "numeric";
      input.min = String(min);
      input.max = String(max);
      input.placeholder = nullable ? "不限" : String(min);
    }
    const dash = documentRef.createElement("span");
    dash.textContent = "—";
    const render = () => {
      const range = current[key] as [number | null, number | null];
      low.value = range[0] === null ? "" : String(range[0]);
      high.value = range[1] === null ? "" : String(range[1]);
    };
    renderers.push(render);
    const update = (shouldRender = true) => {
      const parse = (input: HTMLInputElement, fallback: number | null) => {
        if (nullable && input.value.trim() === "") return null;
        const value = Number(input.value);
        return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
      };
      let next: [number | null, number | null] = [
        parse(low, nullable ? null : min),
        parse(high, nullable ? null : max),
      ];
      if (next[0] !== null && next[1] !== null && next[0] > next[1]) next = [next[1], next[1]];
      const previous = current[key] as [number | null, number | null];
      if (previous[0] !== next[0] || previous[1] !== next[1]) {
        (current as unknown as Record<string, unknown>)[key] = next;
        changed.add(key);
        restored = false;
        options.onChange?.(key, next as never);
      }
      if (shouldRender) render();
    };
    synchronizers.push(() => update(false));
    low.addEventListener("input", () => update(false));
    high.addEventListener("input", () => update(false));
    low.addEventListener("change", () => update(true));
    high.addEventListener("change", () => update(true));
    controls.append(low, dash, high);
    row.append(title, controls);
    render();
    appendRuleRow(row, parent);
  };

  const toggle = (
    label: string,
    key: CandidateToggleRuleKey,
    help: string,
    parent: HTMLElement = grid,
    onToggle?: () => void,
  ) => {
    const row = documentRef.createElement("label");
    row.className = "fcx-candidate-rules__field fcx-candidate-rules__toggle";
    const copy = documentRef.createElement("span");
    const title = documentRef.createElement("span");
    title.textContent = label;
    const detail = documentRef.createElement("small");
    detail.textContent = help;
    copy.append(title, detail);
    const input = documentRef.createElement("input");
    input.type = "checkbox";
    input.checked = current[key];
    input.setAttribute("aria-label", label);
    const track = documentRef.createElement("span");
    track.className = "fcx-switch__track";
    const control = documentRef.createElement("span");
    control.className = "fcx-switch";
    control.append(input, track);
    const render = () => {
      input.checked = current[key];
    };
    renderers.push(render);
    input.addEventListener("change", () => {
      current[key] = input.checked;
      changed.add(key);
      restored = false;
      options.onChange?.(key, input.checked);
      render();
      onToggle?.();
    });
    row.append(copy, control);
    render();
    appendRuleRow(row, parent);
  };

  const numericValue = (
    label: string,
    key: "squadRatingOvershoot",
    min: number,
    max: number,
    step: number,
    help: string,
  ) => {
    const row = documentRef.createElement("label");
    row.className = "fcx-candidate-rules__field fcx-candidate-rules__number";
    const copy = documentRef.createElement("span");
    const title = documentRef.createElement("span");
    title.textContent = label;
    const detail = documentRef.createElement("small");
    detail.textContent = help;
    copy.append(title, detail);
    const input = documentRef.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const render = () => {
      input.value = Number(current[key]).toFixed(1);
    };
    renderers.push(render);
    const update = (shouldRender = true) => {
      const parsed = Number(input.value);
      const previous = Number(current[key]);
      const next = Number.isFinite(parsed)
        ? Math.round(Math.min(max, Math.max(min, parsed)) * 10) / 10
        : previous;
      if (next !== previous) {
        current[key] = next;
        changed.add(key);
        restored = false;
        options.onChange?.(key, next);
      }
      if (shouldRender) render();
    };
    synchronizers.push(() => update(false));
    input.addEventListener("input", () => update(false));
    input.addEventListener("change", () => update(true));
    row.append(copy, input);
    render();
    grid.appendChild(row);
  };

  numericPair("球员总评范围", "ratingRange", 0, 99, false);
  numericPair("球员价格范围（读不到价格时不要设置）", "priceRange", 0, 15_000_000, true);
  numericValue(
    "球队评分允许上浮",
    "squadRatingOvershoot",
    0,
    5,
    0.1,
    "例如要求 83，设置 1.8 时接受 83.00–84.80。",
  );
  toggle("只用普通卡", "commonOnly", "仅允许 EA 卡片 rareflag = 0；稀有金卡和特殊卡都会被排除。 ");
  toggle(
    "允许额外消耗必需特殊卡",
    "allowExtraRequiredRarityGroupPlayers",
    "关闭时，挑战点名的特殊分组只使用要求数量；不限制其他特殊卡。 ",
  );
  subheading(
    "必需特殊卡",
    "开启后，仅命中当前挑战特殊卡要求的球员使用下面的单独范围。",
  );
  toggle(
    "启用特殊献祭卡规则",
    "specialFuelRulesEnabled",
    "关闭时完全沿用上面的总评与价格范围，保持旧版行为。",
    grid,
    () => renderers.forEach((render) => render()),
  );
  const specialFuelDetails = documentRef.createElement("div");
  specialFuelDetails.className = "fcx-candidate-rules__details";
  specialFuelDetails.setAttribute("aria-label", "特殊献祭卡详细设置");
  const renderSpecialFuelDetails = () => {
    const collapsed = !current.specialFuelRulesEnabled;
    specialFuelDetails.hidden = collapsed;
    specialFuelDetails.setAttribute("aria-hidden", String(collapsed));
  };
  renderers.push(renderSpecialFuelDetails);
  renderSpecialFuelDetails();
  grid.appendChild(specialFuelDetails);
  numericPair("直接献祭总评范围", "specialFuelRatingRange", 0, 99, false, specialFuelDetails);
  numericPair(
    "特殊献祭卡价格范围（读不到价格时不要设置）",
    "specialFuelPriceRange",
    0,
    15_000_000,
    true,
    specialFuelDetails,
  );
  toggle(
    "直接范围只用 SBC 仓库",
    "specialFuelOnlyStorage",
    "开启后，直接献祭范围内的特殊卡也必须来自 SBC 仓库。",
    specialFuelDetails,
  );
  toggle(
    "启用 SBC 仓库额外范围",
    "specialFuelStorageRulesEnabled",
    "允许更高分特殊卡只在 SBC 仓库中作为献祭卡进入候选池。",
    specialFuelDetails,
  );
  numericPair("SBC 仓库额外总评范围", "specialFuelStorageRatingRange", 0, 99, false, specialFuelDetails);
  restore.addEventListener("click", () => {
    const next = options.onRestore?.();
    if (!next) return;
    current = structuredClone(next);
    changed.clear();
    restored = true;
    renderers.forEach((render) => render());
  });
  root.append(heading, grid);
  return {
    element: root,
    getValue: () => {
      synchronizers.forEach((synchronize) => synchronize());
      return {
        ratingRange: [...current.ratingRange],
        priceRange: [...current.priceRange],
        squadRatingOvershoot: current.squadRatingOvershoot,
        commonOnly: current.commonOnly,
        allowExtraRequiredRarityGroupPlayers:
          current.allowExtraRequiredRarityGroupPlayers,
        specialFuelRulesEnabled: current.specialFuelRulesEnabled,
        specialFuelRatingRange: [...current.specialFuelRatingRange],
        specialFuelPriceRange: [...current.specialFuelPriceRange],
        specialFuelOnlyStorage: current.specialFuelOnlyStorage,
        specialFuelStorageRulesEnabled: current.specialFuelStorageRulesEnabled,
        specialFuelStorageRatingRange: [...current.specialFuelStorageRatingRange],
      };
    },
    changedKeys: () => new Set(changed),
    restored: () => restored,
  };
}
