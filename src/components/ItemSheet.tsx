import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { newId } from '../lib/ids';
import { useStore } from '../state/store';
import type { Item } from '../types';
import { CategoryPicker, initialChoice, resolveCategory } from './CategoryPicker';
import { PhotoField, readPhoto } from './PhotoField';
import { useToast } from './Toast';
import { Confirm, ErrorText, Field, MoneyInput, Sheet, Stepper, useMoneyText } from './ui';

interface ItemSheetProps {
  item: Item;
  onClose: () => void;
}

export function ItemSheet({ item, onClose }: ItemSheetProps) {
  const { state, dispatch, photos, setPhoto } = useStore();
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [priceText, setPriceText, price] = useMoneyText(item.price);
  const [stock, setStock] = useState(Math.max(0, item.stock));
  const [category, setCategory] = useState(() => initialChoice(state.categories, item.categoryId));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');
  const photo = photos[item.id];
  // Move up/down works within the saved category, not the one being picked.
  const siblings = state.items.filter((other) => other.categoryId === item.categoryId);
  const position = siblings.findIndex((other) => other.id === item.id) + 1;
  const priceId = useId();
  const stockId = useId();

  function save() {
    if (!name.trim()) return setError('Add a name.');
    if (price === null) return setError('That price doesn’t look right.');
    const categoryId = resolveCategory(category, state.categories, dispatch);
    if (categoryId === null) return setError('Pick a category, or name a new one.');
    dispatch({
      type: 'item/save',
      item: { ...item, name: name.trim(), price, stock, categoryId },
    });
    onClose();
  }

  function changePhoto(next: string | null) {
    setError('');
    setPhoto(item.id, next);
  }

  function duplicate() {
    const copyId = newId();
    dispatch({
      type: 'item/save',
      item: { ...item, id: copyId, name: `${item.name} (copy)` },
    });
    if (photo) setPhoto(copyId, photo);
    toast({ text: 'Copy added' });
    onClose();
  }

  function remove() {
    setPhoto(item.id, null);
    dispatch({ type: 'item/delete', id: item.id });
    onClose();
  }

  if (confirmingDelete) {
    return (
      <Confirm
        title={`Delete ${item.name}?`}
        message="Sales you already logged won't change."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    );
  }

  return (
    <Sheet
      title="Edit item"
      onClose={onClose}
      fileDrop={{
        label: photo ? 'Drop to replace the photo' : 'Drop to add a photo',
        onFile: (file) => readPhoto(file, changePhoto, setError),
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <PhotoField photo={photo} onChange={changePhoto} onError={setError} />

        <Field label="Name">
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="row two-up">
          <div className="field">
            <label className="field-label" htmlFor={priceId}>
              Price
            </label>
            <MoneyInput id={priceId} value={priceText} onChange={setPriceText} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={stockId}>
              In stock
            </label>
            <Stepper id={stockId} value={stock} onChange={setStock} label="in stock" />
          </div>
        </div>
        <CategoryPicker categories={state.categories} choice={category} onChange={setCategory} />

        <div className="field">
          <span className="field-label">Order in the list</span>
          <div className="row wrap">
            <button
              type="button"
              className="button small"
              disabled={position <= 1}
              onClick={() => dispatch({ type: 'item/shift', id: item.id, direction: -1 })}
            >
              <ArrowUp size={16} aria-hidden="true" /> Move up
            </button>
            <button
              type="button"
              className="button small"
              disabled={position >= siblings.length}
              onClick={() => dispatch({ type: 'item/shift', id: item.id, direction: 1 })}
            >
              <ArrowDown size={16} aria-hidden="true" /> Move down
            </button>
            <span className="small muted" aria-live="polite">
              {position} of {siblings.length}
            </span>
          </div>
        </div>

        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" className="button primary wide">
          Save
        </button>
        <div className="row">
          <button type="button" className="button grow" onClick={duplicate}>
            <Copy size={18} aria-hidden="true" /> Make a copy
          </button>
          <button
            type="button"
            className="button danger grow"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={18} aria-hidden="true" /> Delete
          </button>
        </div>
      </form>
    </Sheet>
  );
}
