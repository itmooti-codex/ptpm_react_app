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

const JobDirectStoreContext = createContext(null);

export function JobDirectStoreProvider({
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
  const stateRef = useRef(state);
  const listenersRef = useRef(new Set());

  useEffect(() => {
    dispatch(setJobUid(jobUid));
  }, [jobUid]);

  useEffect(() => {
    if (!jobUid && !jobData && !lookupData) return;
    dispatch(hydrateBootstrapState({ jobUid, jobData, lookupData }));
  }, [jobUid, jobData, lookupData]);

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

  return <JobDirectStoreContext.Provider value={store}>{children}</JobDirectStoreContext.Provider>;
}

export function useJobDirectStore() {
  const context = useContext(JobDirectStoreContext);
  if (!context) {
    throw new Error("useJobDirectStore must be used within JobDirectStoreProvider.");
  }
  return context;
}

export function useJobDirectStoreState() {
  const store = useJobDirectStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useJobDirectStoreActions() {
  return useJobDirectStore().actions;
}

export function useJobDirectSelector(selector) {
  const store = useJobDirectStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSelection = useCallback(
    () => selectorRef.current(store.getState()),
    [store]
  );
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
