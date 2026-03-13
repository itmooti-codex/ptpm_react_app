import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { bindJobDirectActions, hydrateBootstrapState, setJobUid } from "../state/actions.js";
import {
  createJobDirectReducerInitialState,
  jobDirectReducer,
} from "../state/reducer.js";

const DetailsWorkspaceStoreContext = createContext(null);

function stableSerialize(value) {
  const seen = new WeakSet();
  const normalize = (input) => {
    if (input === null || input === undefined) return input ?? null;
    if (typeof input !== "object") return input;
    if (seen.has(input)) return "__cycle__";
    seen.add(input);
    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }
    const normalizedObject = {};
    Object.keys(input)
      .sort()
      .forEach((key) => {
        normalizedObject[key] = normalize(input[key]);
      });
    return normalizedObject;
  };

  try {
    return JSON.stringify(normalize(value));
  } catch (_) {
    return "";
  }
}

export function DetailsWorkspaceStoreProvider({
  children,
  jobUid = null,
  jobData = null,
  lookupData = null,
}) {
  const [state, dispatch] = useReducer(
    jobDirectReducer,
    jobUid,
    createJobDirectReducerInitialState
  );
  const bootstrapSignature = useMemo(() => {
    if (!jobUid && !jobData && !lookupData) return "";
    return [
      String(jobUid || ""),
      stableSerialize(jobData),
      stableSerialize(lookupData),
    ].join("::");
  }, [jobData, jobUid, lookupData]);
  const stateRef = useRef(state);
  const listenersRef = useRef(new Set());
  const previousBootstrapSignatureRef = useRef("");

  useEffect(() => {
    dispatch(setJobUid(jobUid));
  }, [jobUid]);

  useEffect(() => {
    if (!bootstrapSignature) {
      previousBootstrapSignatureRef.current = "";
      return;
    }
    if (previousBootstrapSignatureRef.current === bootstrapSignature) return;
    previousBootstrapSignatureRef.current = bootstrapSignature;
    dispatch(hydrateBootstrapState({ jobUid, jobData, lookupData }));
  }, [bootstrapSignature, jobData, jobUid, lookupData]);

  useEffect(() => {
    stateRef.current = state;
    listenersRef.current.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[JobDirect] Store listener failed", error);
      }
    });
  }, [state]);

  const getState = useCallback(() => stateRef.current, []);
  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  const actions = useMemo(() => bindJobDirectActions(dispatch), [dispatch]);
  const store = useMemo(
    () => ({
      getState,
      subscribe,
      dispatch,
      actions,
    }),
    [getState, subscribe, dispatch, actions]
  );

  return <DetailsWorkspaceStoreContext.Provider value={store}>{children}</DetailsWorkspaceStoreContext.Provider>;
}

export function useDetailsWorkspaceStore() {
  const context = useContext(DetailsWorkspaceStoreContext);
  if (!context) {
    throw new Error("useDetailsWorkspaceStore must be used within DetailsWorkspaceStoreProvider.");
  }
  return context;
}

export function useDetailsWorkspaceStoreState() {
  const store = useDetailsWorkspaceStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useDetailsWorkspaceStoreActions() {
  return useDetailsWorkspaceStore().actions;
}

export function useDetailsWorkspaceSelector(selector) {
  const store = useDetailsWorkspaceStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSelection = useCallback(
    () => selectorRef.current(store.getState()),
    [store]
  );
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
