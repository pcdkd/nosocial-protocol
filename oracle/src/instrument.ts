import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || "development",
    release: "oracle@0.1.0",
    tracesSampleRate: 1.0,
  });
}
