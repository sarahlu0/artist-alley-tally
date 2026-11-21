import { useId, useState } from 'react';
import { formatMoney } from '../lib/money';
import { useStore } from '../state/store';
import type { AppState, Deal, DealKind } from '../types';
import { ChoiceGroup, ErrorText, Field, MoneyInput, Sheet, Stepper, useMoneyText } from './ui';

const KINDS: Array<{ kind: DealKind; title: string; example: () => string }> = [
  {
    kind: 'mix',
    title: 'A few for a price',
    example: () => `Any 3 stickers for ${formatMoney(1000)}`,
  },
  {
    kind: 'set',
    title: 'A set',
    example: () => `This print + this charm for ${formatMoney(2000)}`,
  },
  { kind: 'bogo', title: 'Get one free', example: () => 'Buy 2 prints, get 1 free' },
];

type Scope = 'categories' | 'items';

/** The name shown at checkout when the artist doesn't type their own. */
function suggestName(deal: Deal, state: AppState): string {
  const names = (ids: string[], source: Array<{ id: string; name: string }>) =>
    source.filter((entry) => ids.includes(entry.id)).map((entry) => entry.name);

  if (deal.kind === 'set') {
    const items = names(deal.itemIds, state.items);
    const label = items.length <= 2 ? items.join(' + ') : `${items.length}-piece set`;
    return `${label} for ${formatMoney(deal.price)}`;
  }
  const what =
    deal.itemIds.length > 0
      ? 'picked items'
      : names(deal.categoryIds, state.categories).join(' / ');
  return deal.kind === 'mix'
    ? `${deal.quantity} ${what || 'items'} for ${formatMoney(deal.price)}`
    : `Buy ${deal.quantity} ${what || 'items'}, get 1 free`;
}

interface DealSheetProps {
  deal: Deal;
  isNew: boolean;
  onClose: () => void;
}

export function DealSheet({ deal, isNew, onClose }: DealSheetProps) {
  const { state, dispatch } = useStore();
  const [kind, setKind] = useState(deal.kind);
  const [quantity, setQuantity] = useState(deal.quantity);
  const [priceText, setPriceText, price] = useMoneyText(isNew ? null : deal.price);
  const [scope, setScope] = useState<Scope>(deal.itemIds.length > 0 ? 'items' : 'categories');
  const [categoryIds, setCategoryIds] = useState(deal.categoryIds);
  const [itemIds, setItemIds] = useState(deal.itemIds);
  const [name, setName] = useState(isNew ? '' : deal.name);
  const [error, setError] = useState('');
  const kindName = useId();
  const quantityId = useId();
  const priceId = useId();

  const pickingItems = kind === 'set' || scope === 'items';
  const draft: Deal = {
    ...deal,
    kind,
    quantity,
    price: price ?? 0,
    categoryIds: pickingItems ? [] : categoryIds,
    itemIds: pickingItems ? itemIds : [],
  };
  const suggested = suggestName(draft, state);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
  }

  function save() {
    if (kind !== 'bogo' && price === null) return setError('Add the deal price.');
    if (kind === 'set' && itemIds.length < 2) return setError('Pick at least two items.');
    if (kind !== 'set' && pickingItems && itemIds.length === 0) {
      return setError('Pick which items count.');
    }
    if (kind !== 'set' && !pickingItems && categoryIds.length === 0) {
      return setError('Pick a category.');
    }
    dispatch({ type: 'deal/save', deal: { ...draft, name: name.trim() || suggested } });
    onClose();
  }

  const priceField = (label: string) => (
    <div className="field">
      <label className="field-label" htmlFor={priceId}>
        {label}
      </label>
      <MoneyInput id={priceId} value={priceText} onChange={setPriceText} />
    </div>
  );

  return (
    <Sheet title={isNew ? 'New deal' : 'Edit deal'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset className="choice-group">
          <legend className="field-label">Kind of deal</legend>
          <div className="kind-list">
            {KINDS.map((option) => (
              <label key={option.kind} className="kind">
                <input
                  type="radio"
                  name={kindName}
                  checked={kind === option.kind}
                  onChange={() => {
                    setKind(option.kind);
                    if (option.kind === 'mix') setQuantity((current) => Math.max(2, current));
                  }}
                />
                <span>
                  <strong>{option.title}</strong>
                  <span className="small muted">{option.example()}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind !== 'set' && (
          <div className="row two-up">
            <div className="field">
              <label className="field-label" htmlFor={quantityId}>
                {kind === 'mix' ? 'How many' : 'Buy how many'}
              </label>
              <Stepper
                id={quantityId}
                value={quantity}
                onChange={setQuantity}
                min={kind === 'mix' ? 2 : 1}
                label="items"
              />
            </div>
            {kind === 'mix' && priceField('For')}
          </div>
        )}

        {kind !== 'set' && (
          <ChoiceGroup
            legend="What counts"
            value={scope}
            onChange={setScope}
            choices={[
              { value: 'categories', label: 'A whole category' },
              { value: 'items', label: 'Certain items' },
            ]}
          />
        )}

        {!pickingItems && (
          <fieldset className="choice-group">
            <legend className="visually-hidden">Categories that count</legend>
            <div className="chips wrap">
              {state.categories.map((category) => (
                <label key={category.id} className="chip">
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={categoryIds.includes(category.id)}
                    onChange={() => setCategoryIds(toggle(categoryIds, category.id))}
                  />
                  <span className="dot" style={{ background: category.color }} aria-hidden="true" />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {pickingItems && (
          <fieldset className="choice-group">
            <legend className={kind === 'set' ? 'field-label' : 'visually-hidden'}>
              {kind === 'set' ? 'Items in the set' : 'Items that count'}
            </legend>
            <ul className="check-list">
              {state.items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={itemIds.includes(item.id)}
                      onChange={() => setItemIds(toggle(itemIds, item.id))}
                    />
                    <span className="grow">{item.name}</span>
                    <span className="muted">{formatMoney(item.price)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {kind === 'set' && priceField('Price for the set')}

        <Field label="Name" hint="(optional)">
          <input
            className="input"
            value={name}
            // Only suggest a name once there's a price to put in it.
            placeholder={price === null && kind !== 'bogo' ? '' : suggested}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" className="button primary wide">
          Save deal
        </button>
        {!isNew && (
          <button
            type="button"
            className="button danger wide"
            onClick={() => {
              dispatch({ type: 'deal/delete', id: deal.id });
              onClose();
            }}
          >
            Delete deal
          </button>
        )}
      </form>
    </Sheet>
  );
}
