export function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);

  if (typeof result.then === "function") {
    return result;
  }

  if (typeof result.toPromise === "function") {
    return result.toPromise();
  }

  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }

  return Promise.resolve(result);
}

export async function fetchDirectWithTimeout(query, options = null, timeoutMs = 30000) {
  const request = options ? query.fetchDirect(options) : query.fetchDirect();
  const requestPromise = toPromiseLike(request);

  let timeoutId = null;
  let didTimeout = false;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      reject(new Error(`Query request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    if (didTimeout && typeof requestPromise?.cancel === "function") {
      requestPromise.cancel();
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function subscribeToQueryStream(query, { onNext, onError } = {}) {
  if (!query) return () => {};

  let stream = null;
  let subscription = null;

  try {
    if (typeof query.subscribe === "function") {
      stream = query.subscribe();
    }
    if (!stream && typeof query.localSubscribe === "function") {
      stream = query.localSubscribe();
    }
    if (!stream || typeof stream.subscribe !== "function") {
      return () => {
        try {
          query?.destroy?.();
        } catch (_) {}
      };
    }

    if (
      typeof window !== "undefined" &&
      typeof window.toMainInstance === "function" &&
      typeof stream.pipe === "function"
    ) {
      stream = stream.pipe(window.toMainInstance(true));
    }

    subscription = stream.subscribe({
      next: (payload) => {
        try {
          onNext?.(payload);
        } catch (callbackError) {
          console.error("[JobDirect] Subscription callback failed", callbackError);
        }
      },
      error: (error) => {
        onError?.(error);
      },
    });
  } catch (error) {
    onError?.(error);
  }

  return () => {
    try {
      subscription?.unsubscribe?.();
    } catch (_) {}
    try {
      query?.destroy?.();
    } catch (_) {}
  };
}

export function isTimeoutError(error) {
  return /timed out/i.test(String(error?.message || ""));
}
