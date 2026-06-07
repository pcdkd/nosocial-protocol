import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || "development",
    release: "oracle@0.1.0",
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    // Drop transactions for scanner / not-found noise so they stop
    // flooding Sentry. These are almost all bots probing for secrets
    // (.env, wp-config.php, .git/config, etc.) and hit non-existent
    // routes, returning 404.
    beforeSendTransaction(event) {
      const status =
        event.contexts?.trace?.data?.["http.response.status_code"] ??
        event.contexts?.response?.status_code ??
        Number(event.tags?.["http.status_code"]);
      if (status === 404) {
        return null;
      }
      return event;
    },
  });
}
