import { FolderPlus, GripVertical, Pencil, Plus, Upload } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { CategoryPicker, initialChoice, resolveCategory } from '../components/CategoryPicker';
import { CategorySheet } from '../components/CategorySheet';
import { DealSheet } from '../components/DealSheet';
import { ImportSheet } from '../components/ImportSheet';
import { ItemSheet } from '../components/ItemSheet';
import { SortableList, useSortableItem } from '../components/Sortable';
import { ErrorText, MoneyInput, Stepper, useMoneyText } from '../components/ui';
import { nextColor } from '../lib/colors';
import { newId } from '../lib/ids';
import { formatMoney } from '../lib/money';
import { plural } from '../lib/format';
import { getSections, sectionKey, stockLevel } from '../state/selectors';
import { useStore } from '../state/store';
import { UNCATEGORIZED, type Category, type Deal, type Item } from '../types';
import '../styles/screens.css';

type Tab = 'items' | 'deals';

export function ItemsScreen() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('items');

  return (
    <div className="screen">
      <h1 className="page-title">Your table</h1>
      <div className="page-body">
        <div className="tabs" role="group" aria-label="Show">
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'items'}
            onClick={() => setTab('items')}
          >
            Items ({state.items.length})
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'deals'}
            onClick={() => setTab('deals')}
          >
            Deals ({state.deals.length})
          </button>
        </div>
        <div className="tab-panel">{tab === 'items' ? <ItemsTab /> : <DealsTab />}</div>
      </div>
    </div>
  );
}

/** Keeps price, stock and category after adding, for entering a run of similar items. */
function QuickAdd() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [priceText, setPriceText, price] = useMoneyText(null);
  const [stock, setStock] = useState(5);
  const [category, setCategory] = useState(() => initialChoice(state.categories));
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), name: useId(), price: useId(), stock: useId() };

  function add() {
    if (!name.trim()) return setError('Add a name.');
    if (price === null) return setError('Add a price, like 4 or 4.50.');
    const categoryId = resolveCategory(category, state.categories, dispatch);
    if (categoryId === null) return setError('Pick a category, or name a new one.');

    dispatch({
      type: 'item/save',
      item: { id: newId(), name: name.trim(), price, stock, categoryId },
    });
    setCategory({ id: categoryId, newName: '' });
    setName('');
    setError('');
    nameRef.current?.focus();
  }

  return (
    <form
      className="quick-add"
      aria-labelledby={ids.title}
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <h2 id={ids.title} className="section-title">
        Add an item
      </h2>
      <div className="quick-fields">
        <div className="field quick-name">
          <label className="field-label" htmlFor={ids.name}>
            Name
          </label>
          <input
            id={ids.name}
            ref={nameRef}
            className="input"
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.price}>
            Price
          </label>
          <MoneyInput id={ids.price} value={priceText} onChange={setPriceText} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.stock}>
            In stock
          </label>
          <Stepper id={ids.stock} value={stock} onChange={setStock} label="in stock" />
        </div>
      </div>
      <CategoryPicker categories={state.categories} choice={category} onChange={setCategory} />
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" className="button primary">
        <Plus size={20} aria-hidden="true" /> Add item
      </button>
    </form>
  );
}

function ItemRow({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const { photos } = useStore();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, style, isDragging } =
    useSortableItem(item.id);
  const level = stockLevel(item.stock);

  return (
    <li ref={setNodeRef} style={style} className="item-row" data-dragging={isDragging}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="drag-handle"
        aria-label={`Move ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <button type="button" className="row-button" onClick={onEdit}>
        {photos[item.id] && <img className="thumb" src={photos[item.id]} alt="" />}
        <span className="grow">{item.name}</span>
        <span className={level === 'ok' ? 'small muted' : 'tag red'}>
          {level === 'out' ? 'None left' : `${item.stock} left`}
        </span>
        <span className="money row-price">{formatMoney(item.price)}</span>
      </button>
    </li>
  );
}

function ItemsTab() {
  const { state, dispatch } = useStore();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{
    category: Category;
    isNew: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const editingItem = state.items.find((item) => item.id === editingItemId);
  const names = useMemo(
    () => new Map(state.items.map((item) => [item.id, item.name])),
    [state.items],
  );
  const sections = getSections(state);

  return (
    <div className="stack">
      <QuickAdd />
      <div className="row wrap">
        <button
          type="button"
          className="button small"
          onClick={() =>
            setEditingCategory({
              category: { id: newId(), name: '', color: nextColor(state.categories.length) },
              isNew: true,
            })
          }
        >
          <FolderPlus size={16} aria-hidden="true" /> New category
        </button>
        <button type="button" className="button small" onClick={() => setImporting(true)}>
          <Upload size={16} aria-hidden="true" /> Import from a spreadsheet
        </button>
      </div>

      {sections.map(({ category, items }) => {
        const key = sectionKey(category);
        return (
          <section key={key} className="group" aria-labelledby={`category-${key}`}>
            <div className="group-head">
              <span className="dot" style={{ background: category.color }} aria-hidden="true" />
              <h2 id={`category-${key}`} className="grow">
                {category.name}
              </h2>
              <span className="small muted">{plural(items.length, 'item')}</span>
              {category.id !== UNCATEGORIZED && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setEditingCategory({ category, isNew: false })}
                  aria-label={`Edit ${category.name}`}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="small muted group-empty">No items yet</p>
            ) : (
              <SortableList
                ids={items.map((item) => item.id)}
                names={names}
                layout="list"
                onReorder={(activeId, overId) =>
                  dispatch({ type: 'item/reorder', activeId, overId })
                }
              >
                <ul className="rows">
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} onEdit={() => setEditingItemId(item.id)} />
                  ))}
                </ul>
              </SortableList>
            )}
          </section>
        );
      })}

      {editingItem && (
        <ItemSheet key={editingItem.id} item={editingItem} onClose={() => setEditingItemId(null)} />
      )}
      {editingCategory && (
        <CategorySheet
          key={editingCategory.category.id}
          category={editingCategory.category}
          isNew={editingCategory.isNew}
          onClose={() => setEditingCategory(null)}
        />
      )}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function blankDeal(): Deal {
  return {
    id: newId(),
    name: '',
    enabled: true,
    kind: 'mix',
    categoryIds: [],
    itemIds: [],
    quantity: 3,
    price: 0,
  };
}

function DealsTab() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<{ deal: Deal; isNew: boolean } | null>(null);

  if (state.items.length === 0) {
    return <p className="empty">Add items first, then you can set up deals.</p>;
  }

  return (
    <div className="stack">
      <p className="muted">Deals apply automatically at checkout.</p>
      {state.deals.length > 0 && (
        <ul className="rows">
          {state.deals.map((deal) => (
            <li key={deal.id} className="deal-row">
              <button
                type="button"
                className="row-button"
                onClick={() => setEditing({ deal, isNew: false })}
              >
                <span className="grow">{deal.name}</span>
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={deal.enabled}
                  onChange={() =>
                    dispatch({ type: 'deal/save', deal: { ...deal, enabled: !deal.enabled } })
                  }
                />
                On<span className="visually-hidden">: {deal.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          className="button"
          onClick={() => setEditing({ deal: blankDeal(), isNew: true })}
        >
          <Plus size={20} aria-hidden="true" /> Add a deal
        </button>
      </div>
      {editing && (
        <DealSheet
          key={editing.deal.id}
          deal={editing.deal}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
