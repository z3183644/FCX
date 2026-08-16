import { localBackendUrl } from "../../config/backend-endpoint";

export type SbcActivityEventType = "challenge_submitted" | "set_completed";

export interface SbcActivityEvent {
  event_id: string;
  event_type: SbcActivityEventType;
  set_id: string;
  set_name: string;
  occurred_at: string;
}

export interface EaSbcCompletionEntry {
  set_id: string;
  set_name: string;
  times_completed: number;
  cycle_id?: string;
}

export interface EaSbcCompletionSnapshot {
  captured_at: string;
  sets: EaSbcCompletionEntry[];
  web_visible_daily_count?: number;
}

const OUTBOX_KEY = "fcx.sbcActivityOutbox.v1";
const EA_SNAPSHOT_KEY = "fcx.sbcEaSnapshot.v1";
const MAX_PENDING_EVENTS = 500;

export function createSbcActivityEvent(
  eventType: SbcActivityEventType,
  setId: unknown,
  setName: unknown,
  randomUUID: () => string = () => crypto.randomUUID(),
  occurredAt = new Date().toISOString(),
): SbcActivityEvent {
  return {
    event_id: `fcx-${eventType}-${randomUUID()}`,
    event_type: eventType,
    set_id: String(setId),
    set_name: String(setName || setId),
    occurred_at: occurredAt,
  };
}

export function createEaSbcCompletionSnapshot(
  sets: Array<Record<string, unknown>>,
  capturedAt = new Date().toISOString(),
  webVisibleDailyCount?: number,
): EaSbcCompletionSnapshot {
  return {
    captured_at: capturedAt,
    sets: sets.map((set) => {
      const setId = String(set.id);
      const cycleMarker = set.endTime ?? set.endDate ?? set.expiresAt;
      return {
        set_id: setId,
        set_name: String(set.name || setId),
        times_completed: Math.max(0, Math.trunc(Number(set.timesCompleted) || 0)),
        ...(cycleMarker ? { cycle_id: `${setId}:${String(cycleMarker)}` } : {}),
      };
    }),
    ...(Number.isSafeInteger(webVisibleDailyCount) && Number(webVisibleDailyCount) >= 0
      ? { web_visible_daily_count: Number(webVisibleDailyCount) }
      : {}),
  };
}

export function readVisibleDailySbcCount(root: Pick<Document, "body">): number | undefined {
  const text = root.body?.innerText || "";
  const match = text.match(/SBC\s*(?:计数|計數|count)\s*[：:]\s*(\d+)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export async function reportSbcActivity(
  backendPort: unknown,
  event: SbcActivityEvent,
  fetchImplementation: typeof fetch = fetch,
): Promise<boolean> {
  const url = localBackendUrl(backendPort, "/stats/sbc-event");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImplementation(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (response.ok) return true;
      if (response.status < 500) return false;
    } catch {
      // Statistics are best-effort and must never interrupt an SBC task.
    }
    if (attempt === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
    }
  }
  return false;
}

async function reportEaSnapshot(
  backendPort: unknown,
  snapshot: EaSbcCompletionSnapshot,
  fetchImplementation: typeof fetch,
): Promise<boolean> {
  try {
    const response = await fetchImplementation(
      localBackendUrl(backendPort, "/stats/ea-snapshot"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export class SbcActivityOutbox {
  private flushing: Promise<void> | undefined;
  private memoryEvents: SbcActivityEvent[] = [];
  private memorySnapshot: EaSbcCompletionSnapshot | undefined;

  constructor(private readonly storage: Storage) {}

  enqueue(event: SbcActivityEvent): void {
    const pending = this.pendingEvents();
    if (!pending.some((item) => item.event_id === event.event_id)) pending.push(event);
    this.writeEvents(pending.slice(-MAX_PENDING_EVENTS));
  }

  saveEaSnapshot(snapshot: EaSbcCompletionSnapshot): void {
    this.memorySnapshot = snapshot;
    try {
      this.storage.setItem(EA_SNAPSHOT_KEY, JSON.stringify(snapshot));
      this.memorySnapshot = undefined;
    } catch {
      // Retain the latest snapshot in memory if browser storage is unavailable.
    }
  }

  hasPending(): boolean {
    if (this.pendingEvents().length > 0 || this.memorySnapshot) return true;
    try {
      return this.storage.getItem(EA_SNAPSHOT_KEY) !== null;
    } catch {
      return false;
    }
  }

  flush(backendPort: unknown, fetchImplementation: typeof fetch = fetch): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushNow(backendPort, fetchImplementation).finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  private async flushNow(
    backendPort: unknown,
    fetchImplementation: typeof fetch,
  ): Promise<void> {
    const pending = this.pendingEvents();
    const delivered = new Set<string>();
    for (const event of pending) {
      if (await reportSbcActivity(backendPort, event, fetchImplementation)) {
        delivered.add(event.event_id);
      }
    }
    this.writeEvents(this.pendingEvents().filter((event) => !delivered.has(event.event_id)));

    const snapshot = this.pendingEaSnapshot();
    if (snapshot && await reportEaSnapshot(backendPort, snapshot, fetchImplementation)) {
      const latest = this.pendingEaSnapshot();
      if (latest?.captured_at === snapshot.captured_at) {
        this.memorySnapshot = undefined;
        try { this.storage.removeItem(EA_SNAPSHOT_KEY); } catch { /* no-op */ }
      }
    }
  }

  private pendingEvents(): SbcActivityEvent[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(OUTBOX_KEY) || "[]") as unknown;
      const stored = Array.isArray(parsed) ? parsed.filter((item): item is SbcActivityEvent => Boolean(
        item && typeof item === "object" && typeof item.event_id === "string",
      )) : [];
      return [...new Map(
        [...stored, ...this.memoryEvents].map((item) => [item.event_id, item]),
      ).values()].slice(-MAX_PENDING_EVENTS);
    } catch {
      return this.memoryEvents.slice(-MAX_PENDING_EVENTS);
    }
  }

  private pendingEaSnapshot(): EaSbcCompletionSnapshot | undefined {
    if (this.memorySnapshot) return this.memorySnapshot;
    try {
      const parsed = JSON.parse(this.storage.getItem(EA_SNAPSHOT_KEY) || "null") as unknown;
      if (!parsed || typeof parsed !== "object") return undefined;
      const snapshot = parsed as EaSbcCompletionSnapshot;
      return Array.isArray(snapshot.sets) ? snapshot : undefined;
    } catch {
      return undefined;
    }
  }

  private writeEvents(events: SbcActivityEvent[]): void {
    this.memoryEvents = events;
    try {
      if (events.length) this.storage.setItem(OUTBOX_KEY, JSON.stringify(events));
      else this.storage.removeItem(OUTBOX_KEY);
      this.memoryEvents = [];
    } catch {
      // Keep the bounded in-memory copy without affecting the SBC task.
    }
  }
}
