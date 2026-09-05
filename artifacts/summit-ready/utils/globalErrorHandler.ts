type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

type ReactNativeErrorUtils = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: ReactNativeErrorUtils;
};

let installed = false;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

/**
 * Logs uncaught JavaScript exceptions before React Native's default handler
 * reports a fatal error. The existing handler is preserved so development
 * error overlays and native crash reporting continue to work normally.
 */
export function installGlobalErrorHandler(): void {
  if (installed) return;

  const errorUtils = (globalThis as GlobalWithErrorUtils).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) {
    console.warn("[global-js-exception] React Native ErrorUtils is unavailable");
    return;
  }

  installed = true;
  const previousHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    const normalized = normalizeError(error);
    console.error(
      `[global-js-exception] fatal=${String(Boolean(isFatal))}`,
      normalized.message,
      normalized.stack ?? "Stack trace unavailable",
    );

    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}