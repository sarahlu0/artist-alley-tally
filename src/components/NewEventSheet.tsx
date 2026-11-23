import { useMemo, useState } from 'react';
import { newId } from '../lib/ids';
import { getCurrentEvent, getSoldByItem } from '../state/selectors';
import { useStore } from '../state/store';
import { Field, Sheet, Stepper } from './ui';

export function NewEventSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const last = getCurrentEvent(state);
  const soldLast = useMemo(() => getSoldByItem(state, last.id), [state, last.id]);
  const [name, setName] = useState('');
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.items.map((item) => [item.id, Math.max(0, item.stock)])),
  );

  function start() {
    dispatch({
      type: 'event/start',
      id: newId(),
      name: name.trim() || 'New event',
      at: Date.now(),
      stock,
    });
    onClose();
  }

  return (
    <Sheet title="Start a new event" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <Field label="Event name">
          <input
            className="input"
            value={name}
            placeholder="ScottyCon"
            maxLength={60}
            data-autofocus
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        {state.items.length > 0 && (
          <fieldset className="choice-group">
            <legend className="field-label">How many are you bringing?</legend>
            <p className="small muted">Starting counts are what you had left.</p>
            <ul className="restock">
              {state.items.map((item) => (
                <li key={item.id}>
                  <span className="grow">
                    {item.name}
                    <span className="small muted">Sold {soldLast.get(item.id) ?? 0} last time</span>
                  </span>
                  <Stepper
                    value={stock[item.id] ?? 0}
                    label={item.name}
                    onChange={(count) => setStock({ ...stock, [item.id]: count })}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <button type="submit" className="button primary wide">
          Start event
        </button>
      </form>
    </Sheet>
  );
}
