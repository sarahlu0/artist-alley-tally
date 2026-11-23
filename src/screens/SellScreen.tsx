import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CartPanel } from '../components/CartPanel';
import { ItemTile } from '../components/ItemTile';
import { SortableList } from '../components/Sortable';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/ui';
import { chargeFor, priceCart } from '../lib/deals';
import { formatMoney } from '../lib/money';
import { plural } from '../lib/format';
import {
  countUnits,
  getActiveCart,
  getCurrentEvent,
  getReserved,
  getSections,
  getSoldByItem,
  sectionKey,
  UNCATEGORIZED_SECTION,
} from '../state/selectors';
import { useStore } from '../state/store';
import type { Category, Item } from '../types';
import '../styles/sell.css';

interface SellScreenProps {
  onGoToItems: () => void;
  onGoToRecap: () => void;
}

type Filter = 'all' | 'popular' | string;

interface Section {
  category: Category | null;
  items: Item[];
}

export function SellScreen({ onGoToItems, onGoToRecap }: SellScreenProps) {
  const { state, dispatch, photos } = useStore();
  const toast = useToast();
  const event = getCurrentEvent(state);
  const cart = getActiveCart(state);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const reserved = useMemo(() => getReserved(state), [state]);
  const sold = useMemo(() => getSoldByItem(state, event.id), [state, event.id]);
  const colors = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category.color])),
    [state.categories],
  );
  const inCart = useMemo(() => new Map(cart.lines.map((line) => [line.itemId, line.qty])), [cart]);
  const pricing = useMemo(
    () => priceCart(cart.lines, state.items, state.deals),
    [cart.lines, state.items, state.deals],
  );

  // "/" focuses search unless the user is typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sections = useMemo((): Section[] => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const names = new Map(state.categories.map((c) => [c.id, c.name.toLowerCase()]));
    const matching = state.items.filter((item) => {
      const haystack = `${item.name.toLowerCase()} ${names.get(item.categoryId) ?? ''}`;
      return words.every((word) => haystack.includes(word));
    });

    if (filter === 'popular') {
      const ranked = [...matching].sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0));
      return [{ category: null, items: ranked }];
    }
    if (words.length > 0) return [{ category: null, items: matching }];
    return getSections({ categories: state.categories, items: matching })
      .filter(({ category }) => filter === 'all' || category.id === filter)
      .filter((section) => section.items.length > 0);
  }, [state.items, state.categories, query, filter, sold]);

  const allSections = useMemo(() => getSections(state), [state]);
  const names = useMemo(
    () => new Map(state.items.map((item) => [item.id, item.name])),
    [state.items],
  );
  // Drag order only makes sense in the unsorted, unfiltered view.
  const dragDisabled = filter === 'popular' || query.trim() !== '';
  // A drop fires a click on the card; ignore clicks right after a drag ends.
  const lastDragEnd = useRef(0);

  const firstMatch = sections[0]?.items[0];
  const units = countUnits(cart);
  const total = chargeFor(cart, pricing);
  const heldCount = state.carts.filter((c) => c.id !== cart.id && c.lines.length > 0).length;

  function goToOrder() {
    const pay = document.querySelector<HTMLElement>('.sell-side .pay-cash');
    // offsetParent is null when the side panel is hidden (phone layout).
    if (pay && pay.offsetParent !== null) pay.focus();
    else setCartOpen(true);
  }

  function add(item: Item) {
    if (Date.now() - lastDragEnd.current < 300) return;
    const left = item.stock - (reserved.get(item.id) ?? 0);
    dispatch({ type: 'cart/add', itemId: item.id });
    // Stock counts can be wrong, so warn instead of blocking the sale.
    if (left <= 0) toast({ text: `${item.name} shows 0 left. Added anyway.` });
  }

  if (event.endedAt !== null) {
    return (
      <div className="screen">
        <h1 className="page-title">Sell</h1>
        <div className="page-body stack">
          <p>{event.name} has ended.</p>
          <div className="row wrap">
            <button type="button" className="button primary" onClick={onGoToRecap}>
              See recap
            </button>
            <button
              type="button"
              className="button"
              onClick={() => dispatch({ type: 'event/reopen' })}
            >
              Reopen event
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="screen">
        <h1 className="page-title">Sell</h1>
        <div className="page-body empty">
          <p>No items yet.</p>
          <p>
            <button type="button" className="button primary" onClick={onGoToItems}>
              Add items
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sell">
      <div className="sell-main">
        <h1 className="page-title">
          Sell <span className="page-title-sub">{event.name}</span>
        </h1>
        <header className="sell-head">
          <div className="search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={searchRef}
              className="input"
              type="search"
              value={query}
              placeholder="Find an item"
              aria-label="Find an item"
              enterKeyHint="done"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query && firstMatch) {
                  add(firstMatch);
                  setQuery('');
                }
                if (e.key === 'Escape') setQuery('');
              }}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </div>
          {/* Visually hidden until focused; skips keyboard users past every card. */}
          <button type="button" className="skip-to-order" onClick={goToOrder}>
            Go to order
          </button>
          <div className="chips" role="group" aria-label="Filter items">
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              Everything
            </button>
            {allSections
              .filter(({ items }) => items.length > 0)
              .map(({ category }) => (
                <button
                  key={sectionKey(category)}
                  type="button"
                  className="chip"
                  aria-pressed={filter === category.id}
                  onClick={() => setFilter(category.id)}
                >
                  <span className="dot" style={{ background: category.color }} aria-hidden="true" />
                  {category.name}
                </button>
              ))}
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'popular'}
              onClick={() => setFilter('popular')}
            >
              Best sellers first
            </button>
          </div>
        </header>

        {sections.length === 0 && <p className="empty">Nothing matches "{query}".</p>}

        {sections.map((section) => (
          <section
            key={section.category ? sectionKey(section.category) : 'flat'}
            className="sell-section"
          >
            {section.category && <h2 className="sell-section-title">{section.category.name}</h2>}
            <SortableList
              ids={section.items.map((item) => item.id)}
              names={names}
              layout="grid"
              onReorder={(activeId, overId) => dispatch({ type: 'item/reorder', activeId, overId })}
              onDragEnd={() => (lastDragEnd.current = Date.now())}
            >
              <div className="tiles">
                {section.items.map((item) => (
                  <ItemTile
                    key={item.id}
                    item={item}
                    dragDisabled={dragDisabled}
                    photo={photos[item.id]}
                    color={colors.get(item.categoryId) ?? UNCATEGORIZED_SECTION.color}
                    left={item.stock - (reserved.get(item.id) ?? 0)}
                    inCart={inCart.get(item.id) ?? 0}
                    onAdd={() => add(item)}
                    onRemove={() =>
                      dispatch({
                        type: 'cart/setQty',
                        itemId: item.id,
                        qty: (inCart.get(item.id) ?? 1) - 1,
                      })
                    }
                  />
                ))}
              </div>
            </SortableList>
          </section>
        ))}
      </div>

      <aside className="sell-side" aria-labelledby="order-title">
        <h2 id="order-title" className="page-title">
          Order
        </h2>
        <div className="page-body">
          <CartPanel />
        </div>
      </aside>

      <div className="cart-bar">
        {units === 0 && heldCount === 0 ? (
          <p className="cart-bar-hint">Tap an item to start an order.</p>
        ) : (
          <button type="button" className="cart-bar-button" onClick={() => setCartOpen(true)}>
            <span>
              {units === 0 ? 'New order' : plural(units, 'item')}
              {heldCount > 0 && <span className="tag">{heldCount} on hold</span>}
            </span>
            <span className="cart-bar-charge">
              {units === 0 ? 'Open' : `Charge ${formatMoney(total)}`}
            </span>
          </button>
        )}
      </div>

      {cartOpen && (
        <Sheet title="Order" onClose={() => setCartOpen(false)}>
          <CartPanel onDone={() => setCartOpen(false)} />
        </Sheet>
      )}
    </div>
  );
}
