import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { newId } from '../lib/ids';
import { setCurrencySymbol } from '../lib/money';
import { loadSaved, requestPersistence, savePhotos, saveState } from '../lib/storage';
import type { AppState, Photos } from '../types';
import { createInitialState, reducer, type Action } from './reducer';

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  photos: Photos;
  /** Pass null to remove an item's photo. */
  setPhoto: (itemId: string, dataUrl: string | null) => void;
  replacePhotos: (photos: Photos) => void;
  /** False if the last save to this device failed (for example, storage is full). */
  saveOk: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

function Loaded({
  initial,
  children,
}: {
  initial: { state: AppState; photos: Photos };
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [photos, setPhotos] = useState(initial.photos);
  const [saveOk, setSaveOk] = useState(true);

  // Set before the children render so every amount on screen uses the new symbol.
  setCurrencySymbol(state.currency);

  useEffect(() => {
    saveState(state).then(
      () => setSaveOk(true),
      () => setSaveOk(false),
    );
  }, [state]);

  useEffect(() => {
    if (photos === initial.photos) return;
    savePhotos(photos).catch(() => setSaveOk(false));
  }, [photos, initial.photos]);

  const setPhoto = useCallback((itemId: string, dataUrl: string | null) => {
    setPhotos((current) => {
      const next = { ...current };
      if (dataUrl) next[itemId] = dataUrl;
      else delete next[itemId];
      return next;
    });
  }, []);

  const store = useMemo(
    () => ({ state, dispatch, photos, setPhoto, replacePhotos: setPhotos, saveOk }),
    [state, photos, setPhoto, saveOk],
  );
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<{ state: AppState; photos: Photos } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    requestPersistence();
    loadSaved().then(
      ({ state, photos }) => {
        setInitial({ state: state ?? createInitialState(newId(), newId(), Date.now()), photos });
      },
      () => setFailed(true),
    );
  }, []);

  // Starting blank here would save over whatever is really on the device, so stop instead.
  if (failed) {
    return (
      <main className="load-failed">
        <h1>Couldn't open your saved data</h1>
        <p>
          Nothing has been lost. Close Tally and open it again. If you're in a private or incognito
          window, switch to a normal one, since private windows can't save.
        </p>
        <button type="button" className="button primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }
  if (!initial) return null;
  return <Loaded initial={initial}>{children}</Loaded>;
}
