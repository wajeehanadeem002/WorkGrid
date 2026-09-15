const TIMEOUT_ERROR_MESSAGE = "The upstream request timed out.";

export function createTimeoutFetch(
  timeoutMs: number,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Request timeout must be a positive integer.");
  }

  return async (input, init) => {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
      timeoutController.abort(
        new DOMException(TIMEOUT_ERROR_MESSAGE, "TimeoutError"),
      );
    }, timeoutMs);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      return await fetcher(input, { ...init, signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}
