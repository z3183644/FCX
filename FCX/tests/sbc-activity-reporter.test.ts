import { describe, expect, it, vi } from "vitest";
import { createSbcActivityEvent, reportSbcActivity } from "../src/domain/sbc/activity-reporter";

describe("SBC activity reporter", () => {
  it("creates a stable deduplication id for one event", () => {
    const event = createSbcActivityEvent("set_completed", 123, "每日升级", () => "fixed-id");
    expect(event).toEqual({
      event_id: "fcx-set_completed-fixed-id",
      event_type: "set_completed",
      set_id: "123",
      set_name: "每日升级",
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
});
