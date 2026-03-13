# CRUD + Subscription Patterns

This document defines the standard patterns for data access in this app.
All new API functions and hooks must follow these patterns.

---

## Core Transport

All SDK operations use helpers from `@modules/details-workspace/exports/api.js`:

```js
import { toPromiseLike, fetchDirectWithTimeout, subscribeToQueryStream } from "@modules/details-workspace/exports/api.js";
```

- `toPromiseLike(result)` — wraps any SDK result (Promise, Observable, or `.toPromise()`) into a real Promise
- `fetchDirectWithTimeout(query, options?, timeoutMs?)` — runs `query.fetchDirect()` with a default 30s timeout; throws on timeout
- `subscribeToQueryStream(query, { onNext, onError })` — subscribes to a query stream and returns an unsubscribe cleanup function

---

## Fetch (read)

```js
export async function fetchNotesForJob({ plugin, jobId } = {}) {
  const normalizedId = toText(jobId);
  if (!plugin?.switchTo || !normalizedId) return [];   // guard: return empty type

  try {
    const query = plugin
      .switchTo("PeterpmNote")
      .query()
      .where("job_id", normalizedId)
      .deSelectAll()
      .select(NOTE_SELECT_FIELDS)
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map(normalizeNoteRecord);
  } catch (error) {
    console.error("[jobNotesApi] fetchNotesForJob failed", error);
    return [];   // never throw from fetch; return empty/null so callers can render
  }
}
```

**Rules:**
- Guard: return empty value (`null`, `[]`, `""`) if required inputs are missing
- Always call `query.getOrInitQueryCalc?.()` before `fetchDirectWithTimeout`
- Catch errors, log them, return the empty value — do **not** throw from fetch functions
- Normalize records before returning

---

## Create / Update / Delete (mutations)

```js
export async function createNote({ plugin, payload } = {}) {
  if (!plugin?.switchTo) throw new Error("SDK plugin is not ready.");

  const model = plugin.switchTo("PeterpmNote");
  if (!model?.mutation) throw new Error("Note model is unavailable.");

  const normalized = normalizeNoteMutationPayload(payload, { forCreate: true });
  if (!toText(normalized?.note)) throw new Error("Note text is required.");

  const mutation = await model.mutation();
  mutation.createOne(normalized);
  const result = await toPromiseLike(mutation.execute(true));

  if (!result || result?.isCancelling) {
    throw new Error("Note creation was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || "Unable to create note.");
  }

  return { id: extractCreatedRecordId(result, "PeterpmNote"), ...normalized };
}
```

**Rules:**
- Validate required inputs and throw `Error` with a clear message
- Normalize payload before sending
- Use `toPromiseLike(mutation.execute(true))` — never call `.toPromise()` directly
- Check `isCancelling` and `extractStatusFailure` after every mutation
- Throw on failure so the calling hook can show an error toast

---

## Subscribe (real-time updates)

```js
export function subscribeNotesByJobId({ plugin, jobId, onChange } = {}) {
  const normalizedId = toText(jobId);
  if (!plugin?.switchTo || !normalizedId) return () => {};

  const query = plugin
    .switchTo("PeterpmNote")
    .query()
    .where("job_id", normalizedId)
    .deSelectAll()
    .select(NOTE_SELECT_FIELDS)
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map(normalizeNoteRecord);
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[jobNotesApi] subscribeNotesByJobId error", error);
    },
  });
}
```

**Rules:**
- Guard: return `() => {}` (no-op) if inputs are missing
- Always return the cleanup function from `subscribeToQueryStream`
- Do not throw from subscription callbacks

---

## Hook: loading state + fetch

```js
export function useJobNotes({ plugin, jobId }) {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const { success, error } = useToast();

  const load = useCallback(async () => {
    if (!plugin || !jobId) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const rows = await fetchNotesForJob({ plugin, jobId });
      setNotes(rows);
    } catch (err) {
      setLoadError(err?.message || "Unable to load notes.");
    } finally {
      setIsLoading(false);
    }
  }, [plugin, jobId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(async (payload) => {
    try {
      await createNote({ plugin, payload });
      await load();
      success("Note added.");
    } catch (err) {
      error("Could not add note.", err?.message);
    }
  }, [plugin, load, success, error]);

  return { notes, isLoading, loadError, handleCreate };
}
```

**Rules:**
- `setIsLoading(true)` before, `setIsLoading(false)` in `finally`
- Clear `loadError` before each load
- Call `load()` again after a successful mutation instead of manually patching state
- Show toasts for mutation success/failure; do not show toasts for background load failures (set `loadError` instead)

---

## Hook: subscription lifecycle

```js
export function useJobNotesSync({ plugin, jobId, onUpdate }) {
  useEffect(() => {
    if (!plugin || !jobId) return;

    const unsubscribe = subscribeNotesByJobId({
      plugin,
      jobId,
      onChange: onUpdate,
    });

    return () => unsubscribe?.();
  }, [plugin, jobId, onUpdate]);
}
```

**Rules:**
- Return the cleanup from `useEffect` — always call `unsubscribe()` on unmount
- Keep subscription hooks thin; they only wire up the subscription and call a callback
- Pass a stable callback reference (`useCallback`) to avoid unnecessary re-subscribes

---

## Naming Conventions

| Operation | Function name |
|-----------|---------------|
| Read list | `fetch*ByJobId`, `fetch*ByInquiryUid` |
| Read single | `fetch*ById`, `fetch*ByUid` |
| Subscribe list | `subscribe*ByJobId`, `subscribe*ByInquiryUid` |
| Create | `create*` |
| Update | `update*ById` |
| Delete | `delete*ById` |
| Hook (data + CRUD) | `use*` (e.g. `useJobNotes`) |
| Hook (subscription only) | `use*Sync` or `use*RealtimeSync` |

---

## Where each layer lives

```
src/modules/details-workspace/exports/api.js    ← transport helpers (toPromiseLike, fetchDirectWithTimeout, subscribeToQueryStream)
src/modules/details-workspace/api/core/         ← internal SDK domain functions
src/modules/job-records/api/                    ← job CRUD functions
src/features/*/api/                             ← feature-specific fetch/subscribe/mutate
src/features/*/hooks/                           ← hooks that call API functions and own loading/error state
src/features/*/components/                      ← components that call hooks, not API directly
```

Components must **never** call API functions directly — always go through a hook.
