import { useId, useState } from 'react';
import { sampleTable } from '../lib/sample';
import { getCurrentEvent } from '../state/selectors';
import { useStore } from '../state/store';
import '../styles/screens.css';

interface WelcomeProps {
  onAddItems: () => void;
  onTrySample: () => void;
}

export function Welcome({ onAddItems, onTrySample }: WelcomeProps) {
  const { state, dispatch } = useStore();
  const event = getCurrentEvent(state);
  const [eventName, setEventName] = useState('');
  const eventId = useId();

  function finish() {
    if (eventName.trim()) {
      dispatch({
        type: 'event/update',
        id: event.id,
        name: eventName.trim(),
        cashFloat: event.cashFloat,
      });
    }
    dispatch({ type: 'welcome/done' });
  }

  return (
    <main className="welcome">
      <div className="welcome-card">
        <h1 className="page-title">Welcome to Artist Alley Tally</h1>
        <div className="page-body stack">
          <p>Log sales at your table and see what sold. Works without wifi.</p>

          <div className="field">
            <label className="field-label" htmlFor={eventId}>
              Event name <span className="hint">(optional)</span>
            </label>
            <input
              id={eventId}
              className="input"
              value={eventName}
              placeholder="ScottyCon"
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>

          <div className="stack tight">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                finish();
                onAddItems();
              }}
            >
              Set up my table
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                dispatch({ type: 'catalog/set', ...sampleTable });
                finish();
                onTrySample();
              }}
            >
              Try with sample items
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
