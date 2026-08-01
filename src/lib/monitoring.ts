import * as Sentry from "@sentry/react";

let initialized = false;

export function initMonitoring() {
  if (initialized || typeof window === "undefined") return;

  const dsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: Number(import.meta.env["VITE_SENTRY_TRACES_SAMPLE_RATE"] ?? "0.05"),
  });
  initialized = true;
}

export function captureAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}
