import { useId, useState } from 'react';
import { normalizeColor, PALETTE, parseHex } from '../lib/colors';
import { plural } from '../lib/format';
import { dealsLostBy } from '../state/reducer';
import { itemsInCategory } from '../state/selectors';
import { useStore } from '../state/store';
import type { Category } from '../types';
import { ErrorText, Field, Sheet } from './ui';

interface CategorySheetProps {
  category: Category;
  isNew?: boolean;
  onClose: () => void;
}

export function CategorySheet({ category, isNew = false, onClose }: CategorySheetProps) {
  const { state, dispatch, setPhoto } = useStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(normalizeColor(category.color));
  const [hexText, setHexText] = useState(color);
  const [error, setError] = useState('');
  const items = itemsInCategory(state.items, category.id);
  const itemCount = items.length;
  const paletteName = useId();
  const customId = useId();
  const hexId = useId();

  function pick(next: string) {
    setColor(next);
    setHexText(next);
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Add a name.');
    const taken = state.categories.some(
      (other) => other.id !== category.id && other.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (taken) return setError(`There's already a category called ${trimmed}.`);
    dispatch({ type: 'category/save', category: { ...category, name: trimmed, color } });
    onClose();
  }

  function remove(deleteItems: boolean) {
    if (deleteItems) items.forEach((item) => setPhoto(item.id, null));
    dispatch({ type: 'category/delete', id: category.id, deleteItems });
    onClose();
  }

  if (confirmingDelete) {
    const lostIfDeleted = dealsLostBy(
      state.deals,
      [category.id],
      items.map((item) => item.id),
    );
    const lostIfKept = dealsLostBy(state.deals, [category.id], []);
    const dealNote = (lost: typeof lostIfKept) =>
      lost.length > 0
        ? ` These deals will also be removed: ${lost.map((d) => d.name).join(', ')}.`
        : '';

    return (
      <Sheet title={`Delete ${category.name}?`} onClose={() => setConfirmingDelete(false)}>
        <div className="stack">
          <p>
            {itemCount > 0
              ? `${category.name} has ${plural(itemCount, 'item')}. You can delete them too, or keep them without a category. Past sales won't change.`
              : 'This category is empty.'}
            {dealNote(lostIfDeleted)}
          </p>
          <div className="stack tight">
            <button type="button" className="button danger" onClick={() => remove(true)}>
              {itemCount > 0
                ? `Delete category and ${plural(itemCount, 'item')}`
                : 'Delete category'}
            </button>
            {itemCount > 0 && (
              <button type="button" className="button" onClick={() => remove(false)}>
                Keep the items as Uncategorized
              </button>
            )}
            {itemCount > 0 && lostIfKept.length !== lostIfDeleted.length && (
              <p className="small muted">{dealNote(lostIfKept).trim()}</p>
            )}
            <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={isNew ? 'New category' : 'Edit category'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <input
            className="input"
            value={name}
            maxLength={40}
            autoComplete="off"
            data-autofocus={isNew || undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <fieldset className="choice-group">
          <legend className="field-label">Color</legend>
          <div className="color-editor">
            <div className="palette">
              {PALETTE.map((swatch) => (
                <label key={swatch.hex} className="swatch" style={{ background: swatch.hex }}>
                  <input
                    type="radio"
                    className="visually-hidden"
                    name={paletteName}
                    checked={color === swatch.hex}
                    onChange={() => pick(swatch.hex)}
                  />
                  <span className="visually-hidden">{swatch.name}</span>
                </label>
              ))}
            </div>

            <div className="color-custom">
              <div className="field">
                <label className="field-label" htmlFor={customId}>
                  Custom
                </label>
                <input
                  id={customId}
                  type="color"
                  className="color-well"
                  value={color}
                  onChange={(event) => pick(event.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={hexId}>
                  Hex
                </label>
                <input
                  id={hexId}
                  className="input hex-input"
                  value={hexText}
                  maxLength={7}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setHexText(event.target.value);
                    const parsed = parseHex(event.target.value);
                    if (parsed) setColor(parsed);
                  }}
                  onBlur={() => setHexText(color)}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" className="button primary wide">
          Save
        </button>
        {!isNew && (
          <button
            type="button"
            className="button danger wide"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete category
          </button>
        )}
      </form>
    </Sheet>
  );
}
