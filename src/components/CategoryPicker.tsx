import { useId, type Dispatch } from 'react';
import { nextColor } from '../lib/colors';
import { newId } from '../lib/ids';
import type { Action } from '../state/reducer';
import { UNCATEGORIZED, type Category } from '../types';
import { ChoiceGroup } from './ui';

const NEW = '__new__';

/** An existing category id, UNCATEGORIZED, or NEW with the name to create on save. */
export interface CategoryChoice {
  id: string;
  newName: string;
}

export function initialChoice(categories: Category[], preferredId?: string): CategoryChoice {
  return { id: preferredId ?? categories[0]?.id ?? UNCATEGORIZED, newName: '' };
}

interface CategoryPickerProps {
  categories: Category[];
  choice: CategoryChoice;
  onChange: (choice: CategoryChoice) => void;
}

/** With no categories yet, renders a single optional name field instead of choices. */
export function CategoryPicker({ categories, choice, onChange }: CategoryPickerProps) {
  const inputId = useId();

  if (categories.length === 0) {
    return (
      <div className="field">
        <label className="field-label" htmlFor={inputId}>
          Category <span className="hint">(optional)</span>
        </label>
        <input
          id={inputId}
          className="input"
          value={choice.newName}
          placeholder="Stickers"
          maxLength={40}
          autoComplete="off"
          onChange={(event) =>
            onChange({
              id: event.target.value.trim() ? NEW : UNCATEGORIZED,
              newName: event.target.value,
            })
          }
        />
      </div>
    );
  }

  return (
    <div className="stack tight">
      <ChoiceGroup
        legend="Category"
        value={choice.id}
        onChange={(id) => onChange({ ...choice, id })}
        choices={[
          ...categories.map((category) => ({
            value: category.id,
            label: (
              <>
                <span className="dot" style={{ background: category.color }} aria-hidden="true" />
                {category.name}
              </>
            ),
          })),
          { value: UNCATEGORIZED, label: 'No category' },
          { value: NEW, label: '+ New' },
        ]}
      />
      {choice.id === NEW && (
        <div className="field">
          <label className="field-label" htmlFor={inputId}>
            New category name
          </label>
          <input
            id={inputId}
            className="input"
            value={choice.newName}
            placeholder="Stickers"
            maxLength={40}
            autoComplete="off"
            onChange={(event) => onChange({ ...choice, newName: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Returns the chosen category id, creating the category first if it is new.
 * Returns null for a new category with no name, or one deleted since it was picked.
 */
export function resolveCategory(
  choice: CategoryChoice,
  categories: Category[],
  dispatch: Dispatch<Action>,
): string | null {
  if (choice.id === UNCATEGORIZED) return UNCATEGORIZED;
  if (choice.id !== NEW) return categories.some((c) => c.id === choice.id) ? choice.id : null;
  const name = choice.newName.trim();
  if (!name) return null;
  const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const category = { id: newId(), name, color: nextColor(categories.length) };
  dispatch({ type: 'category/save', category });
  return category.id;
}
