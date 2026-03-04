const lookupSubscriptionRegistry = new Map();

function safeStop(entry) {
  try {
    entry?.stop?.();
  } catch (error) {
    console.warn("[JobDirect] Failed stopping shared lookup subscription", error);
  }
}

export function registerSharedLookupSubscription({ key, start } = {}) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || typeof start !== "function") return () => {};

  let entry = lookupSubscriptionRegistry.get(normalizedKey);
  if (!entry) {
    let didStart = false;
    const nextEntry = {
      refCount: 0,
      stop: () => {},
    };
    try {
      const unsubscribe = start();
      didStart = true;
      if (typeof unsubscribe === "function") {
        nextEntry.stop = unsubscribe;
      }
    } catch (error) {
      console.error("[JobDirect] Failed starting shared lookup subscription", error);
    }
    if (!didStart) {
      return () => {};
    }
    lookupSubscriptionRegistry.set(normalizedKey, nextEntry);
    entry = nextEntry;
  }

  entry.refCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;

    const currentEntry = lookupSubscriptionRegistry.get(normalizedKey);
    if (!currentEntry) return;

    currentEntry.refCount -= 1;
    if (currentEntry.refCount > 0) return;

    lookupSubscriptionRegistry.delete(normalizedKey);
    safeStop(currentEntry);
  };
}
