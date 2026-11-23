import { ChartColumn, Ellipsis, ReceiptText, Store, Tags, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './components/Logo';
import { ToastProvider } from './components/Toast';
import { ItemsScreen } from './screens/ItemsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { RecapScreen } from './screens/RecapScreen';
import { SalesScreen } from './screens/SalesScreen';
import { SellScreen } from './screens/SellScreen';
import { Welcome } from './screens/Welcome';
import { StoreProvider, useStore } from './state/store';
import './styles/shell.css';

const TABS = [
  { id: 'sell', label: 'Sell', icon: Store },
  { id: 'items', label: 'Table', icon: Tags },
  { id: 'sales', label: 'Sales', icon: ReceiptText },
  { id: 'recap', label: 'Recap', icon: ChartColumn },
  { id: 'more', label: 'More', icon: Ellipsis },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const id = window.location.hash.slice(1);
  return TABS.find((tab) => tab.id === id)?.id ?? 'sell';
}

/** The open tab lives in the address (#sales), so Back and reload behave. */
function useTab(): [TabId, (tab: TabId) => void] {
  const [tab, setTab] = useState(tabFromHash);
  useEffect(() => {
    const onChange = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [tab, (next) => (window.location.hash = next)];
}

/** Stops a file dropped outside a drop target from replacing the app with the file. */
function useIgnoreStrayDrops() {
  useEffect(() => {
    function ignore(event: DragEvent) {
      if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'none';
    }
    window.addEventListener('dragover', ignore);
    window.addEventListener('drop', ignore);
    return () => {
      window.removeEventListener('dragover', ignore);
      window.removeEventListener('drop', ignore);
    };
  }, []);
}

function Shell() {
  const { state, saveOk } = useStore();
  const [tab, goTo] = useTab();
  useIgnoreStrayDrops();
  const tabLabel = TABS.find(({ id }) => id === tab)?.label;

  // Screen readers announce the page title, so it should say which tab is open.
  useEffect(() => {
    document.title = state.welcomed ? `${tabLabel} · Artist Alley Tally` : 'Artist Alley Tally';
  }, [tabLabel, state.welcomed]);

  if (!state.welcomed) {
    return <Welcome onAddItems={() => goTo('items')} onTrySample={() => goTo('sell')} />;
  }

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#content"
        onClick={(event) => {
          // The address hash holds the open tab, so move focus without changing it.
          event.preventDefault();
          document.getElementById('content')?.focus();
        }}
      >
        Skip to content
      </a>
      <nav className="nav" aria-label="Main">
        <div className="nav-logo">
          <Logo />
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="nav-tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => goTo(id)}
          >
            <Icon size={22} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <main className="shell-main" id="content" tabIndex={-1}>
        {!saveOk && (
          <p className="save-warning" role="alert">
            Couldn't save to this device. Free up some space, then save a backup from More.
          </p>
        )}
        {tab === 'sell' && (
          <SellScreen onGoToItems={() => goTo('items')} onGoToRecap={() => goTo('recap')} />
        )}
        {tab === 'items' && <ItemsScreen />}
        {tab === 'sales' && <SalesScreen onGoToSell={() => goTo('sell')} />}
        {tab === 'recap' && <RecapScreen />}
        {tab === 'more' && <MoreScreen />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
