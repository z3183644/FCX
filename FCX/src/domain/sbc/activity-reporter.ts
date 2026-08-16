import { localBackendUrl } from "../../config/backend-endpoint";

export type SbcActivityEventType = "challenge_submitted" | "set_completed";

export interface SbcActivityEvent {
  event_id: string;
  event_type: SbcActivityEventType;
  set_id: string;
  set_name: string;
}

export function createSbcActivityEvent(
  eventType: SbcActivityEventType,
  setId: unknown,
  setName: unknown,
  randomUUID: () => string = () => crypto.randomUUID(),
): SbcActivityEvent {
  return {
    event_id: `fcx-${eventType}-${randomUUID()}`,
    event_type: eventType,
    set_id: String(setId),
    set_name: String(setName || setId),
  };
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
