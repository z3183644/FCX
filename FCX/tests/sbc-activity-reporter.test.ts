import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEaSbcCompletionSnapshot,
  createSbcActivityEvent,
  readVisibleDailySbcCount,
  reportSbcActivity,
  SbcActivityOutbox,
} from "../src/domain/sbc/activity-reporter";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("SBC activity reporter", () => {
  let storage: Storage;
  beforeEach(() => { storage = new MemoryStorage(); });

  it("creates a stable deduplication id for one event", () => {
    const event = createSbcActivityEvent(
      "set_completed", 123, "每日升级", () => "fixed-id", "2026-08-16T10:00:00.000Z",
    );
    expect(event).toEqual({
      event_id: "fcx-set_completed-fixed-id",
      event_type: "set_completed",
      set_id: "123",
      set_name: "每日升级",
      occurred_at: "2026-08-16T10:00:00.000Z",
    });
  });

  it("retries with the same body without throwing into the SBC task", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const event = createSbcActivityEvent("challenge_submitted", 7, "挑战", () => "same");
    await expect(reportSbcActivity(8000, event, fetchMock)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestBodies = fetchMock.mock.calls.map((call) => call[1]?.body);
    expect(requestBodies).toEqual([JSON.stringify(event), JSON.stringify(event)]);
  });

  it("returns false for a client rejection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    await expect(reportSbcActivity(8000, createSbcActivityEvent("set_completed", 1, "X"), fetchMock))
      .resolves.toBe(false);
  });

  it("keeps failed events and flushes them after the backend recovers", async () => {
    const outbox = new SbcActivityOutbox(storage);
    outbox.enqueue(createSbcActivityEvent("set_completed", 9, "离线挑战", () => "offline"));
    await outbox.flush(8000, vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    expect(outbox.hasPending()).toBe(true);

    const recovered = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await outbox.flush(8000, recovered);
    expect(outbox.hasPending()).toBe(false);
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it("stores the latest EA account snapshot for later synchronization", async () => {
    const outbox = new SbcActivityOutbox(storage);
    outbox.saveEaSnapshot(createEaSbcCompletionSnapshot([
      { id: 12, name: "手机完成项目", timesCompleted: 7 },
    ], "2026-08-16T10:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await outbox.flush(9123, fetchMock);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:9123/stats/ea-snapshot");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sets: [{ set_id: "12", times_completed: 7 }],
    });
    expect(outbox.hasPending()).toBe(false);
  });

  it("reads a daily SBC count already shown on the web page", () => {
    expect(readVisibleDailySbcCount({
      body: { innerText: "Team Jie  SBC计数：102" },
    } as unknown as Document)).toBe(102);
    expect(readVisibleDailySbcCount({
      body: { innerText: "SBC count: 7" },
    } as unknown as Document)).toBe(7);
  });

  it("includes the visible daily count in the backend snapshot", () => {
    expect(createEaSbcCompletionSnapshot([], "2026-08-16T10:00:00.000Z", 102))
      .toMatchObject({ web_visible_daily_count: 102 });
  });
});
