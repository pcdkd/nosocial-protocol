import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!posthog && process.env.POSTHOG_API_KEY) {
    posthog = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 10,
      flushInterval: 30000,
    });
  }
  return posthog;
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  const ph = getPostHog();
  if (!ph) return;

  ph.capture({
    distinctId,
    event,
    properties,
  });
}

export async function shutdownAnalytics(): Promise<void> {
  if (posthog) {
    await posthog.shutdown();
  }
}
