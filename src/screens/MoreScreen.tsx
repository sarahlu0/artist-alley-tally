import { Pause } from 'lucide-react';
import { useId, useState } from 'react';
import { useToast } from '../components/Toast';
import { Confirm, ErrorText } from '../components/ui';
import { saveFile } from '../lib/files';
import { newId } from '../lib/ids';
import { formatMoney } from '../lib/money';
import { formatDay, plural } from '../lib/format';
import { sampleTable } from '../lib/sample';
import { buildBackup, readBackup } from '../lib/storage';
import { createInitialState } from '../state/reducer';
import { useStore } from '../state/store';
import type { AppState, Photos } from '../types';
import '../styles/screens.css';

const MAX_BACKUP_BYTES = 60_000_000;
const CURRENCIES = [
  { symbol: '$', name: 'Dollar' },
  { symbol: '€', name: 'Euro' },
  { symbol: '£', name: 'Pound' },
  { symbol: '¥', name: 'Yen / Yuan' },
  { symbol: '₩', name: 'Won' },
  { symbol: '₱', name: 'Peso (PHP)' },
  { symbol: '₹', name: 'Rupee' },
  { symbol: 'CA$', name: 'Canadian dollar' },
  { symbol: 'A$', name: 'Australian dollar' },
  { symbol: 'R$', name: 'Real' },
];

export function MoreScreen() {
  const { state, dispatch, photos, replacePhotos } = useStore();
  const toast = useToast();
  const [pendingRestore, setPendingRestore] = useState<{ state: AppState; photos: Photos } | null>(
    null,
  );
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [error, setError] = useState('');
  const currencyId = useId();

  const isBlank = state.items.length === 0 && state.sales.length === 0;

  async function saveBackup() {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const saved = await saveFile(
      `tally-backup-${day}.json`,
      buildBackup(state, photos, now),
      'application/json',
    );
    if (saved) dispatch({ type: 'backup/done', at: now });
  }

  async function pickBackup(file: File | undefined) {
    if (!file) return;
    setError('');
    if (file.size > MAX_BACKUP_BYTES) return setError('That file is too big to be a Tally backup.');
    const backup = readBackup(await file.text());
    if (!backup) {
      return setError('That file isn’t a Tally backup. Backups are named tally-backup.');
    }
    setPendingRestore(backup);
  }

  function restore() {
    if (!pendingRestore) return;
    dispatch({ type: 'state/replace', state: { ...pendingRestore.state, welcomed: true } });
    replacePhotos(pendingRestore.photos);
    setPendingRestore(null);
    toast({ text: 'Backup restored' });
  }

  function erase() {
    dispatch({
      type: 'state/replace',
      state: { ...createInitialState(newId(), newId(), Date.now()), welcomed: true },
    });
    replacePhotos({});
    setConfirmingErase(false);
    toast({ text: 'Everything erased' });
  }

  return (
    <div className="screen">
      <h1 className="page-title">More</h1>

      <div className="page-body stack">
        <section className="section-block stack tight" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="section-title">
            How it works
          </h2>
          <ul className="steps">
            <li>
              <strong>Table</strong> is where you add your products and deals.
            </li>
            <li>
              <strong>Sell</strong> is where you'll be during the event. Tap products to build an
              order, then tap a payment method to log it.
            </li>
            <li>
              Need to keep more than one order going? Press{' '}
              <strong>
                <Pause size={14} aria-hidden="true" /> Hold
              </strong>{' '}
              and come back to it later.
            </li>
            <li>
              Traded with someone or gave something away? Log it as <strong>Trade</strong> or{' '}
              <strong>Freebie</strong> so your stock stays right.
            </li>
            <li>
              <strong>Recap</strong> shows what you made and what sold.
            </li>
          </ul>
        </section>

        <section className="section-block stack tight" aria-labelledby="keyboard-title">
          <h2 id="keyboard-title" className="section-title">
            Keyboard
          </h2>
          <dl className="shortcuts">
            <dt>
              <kbd>/</kbd>
            </dt>
            <dd>Jump to the search box on Sell</dd>
            <dt>
              <kbd>Enter</kbd> in search
            </dt>
            <dd>Add the first matching item</dd>
            <dt>
              <kbd>Tab</kbd> after search
            </dt>
            <dd>
              <strong>Go to order</strong>, which jumps to the payment buttons
            </dd>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>Clear the search, or close a window</dd>
            <dt>
              <kbd>Space</kbd> on a drag handle
            </dt>
            <dd>Pick up an item on Table, move it with the arrow keys, Space again to drop</dd>
          </dl>
        </section>

        <section className="section-block stack tight" aria-labelledby="currency-title">
          <h2 id="currency-title" className="section-title">
            Currency
          </h2>
          <div className="field">
            <label className="field-label" htmlFor={currencyId}>
              Symbol
            </label>
            <select
              id={currencyId}
              className="select currency-select"
              value={state.currency}
              onChange={(event) =>
                dispatch({ type: 'settings/currency', symbol: event.target.value })
              }
            >
              {CURRENCIES.map(({ symbol, name }) => (
                <option key={symbol} value={symbol}>
                  {symbol} {name}
                </option>
              ))}
              {!CURRENCIES.some(({ symbol }) => symbol === state.currency) && (
                <option value={state.currency}>{state.currency}</option>
              )}
            </select>
          </div>
          <p className="small muted">Prices will show as {formatMoney(1250)}.</p>
        </section>

        <section className="section-block stack tight" aria-labelledby="install-title">
          <h2 id="install-title" className="section-title">
            Install
          </h2>
          <p>Add Tally to your home screen to open it like an app, even without wifi.</p>
          <ul className="steps">
            <li>
              <strong>iPhone or iPad:</strong> in Safari, tap Share, then Add to Home Screen.
            </li>
            <li>
              <strong>Android:</strong> in Chrome, open the menu and tap Install app.
            </li>
            <li>
              <strong>Laptop:</strong> - in Chrome, click on the 3 dots in the corner &gt; Cast,
              save, and share &gt; Install Artist Alley Tally
            </li>
          </ul>
        </section>

        <section className="section-block stack tight" aria-labelledby="backup-title">
          <h2 id="backup-title" className="section-title">
            Data
          </h2>
          <p>
            Your data is only saved on this device. Make sure you export your data to save a backup
            file of your items, photos and sales, so you can move them to another device or keep a
            copy.
          </p>
          <p className="small muted">
            {state.lastBackupAt
              ? `Last backup: ${formatDay(state.lastBackupAt)}`
              : 'No backups yet'}
          </p>
          <div className="row wrap">
            <button type="button" className="button primary" onClick={saveBackup}>
              Export data
            </button>
            <label className="button file-button">
              Import data
              <input
                type="file"
                accept=".json,application/json"
                className="visually-hidden"
                onChange={(event) => {
                  pickBackup(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
        </section>

        {isBlank && (
          <section className="section-block stack tight" aria-labelledby="sample-title">
            <h2 id="sample-title" className="section-title">
              Try it out
            </h2>
            <p>Load sample items and deals to practice with.</p>
            <div>
              <button
                type="button"
                className="button"
                onClick={() => {
                  dispatch({ type: 'catalog/set', ...sampleTable });
                  toast({ text: 'Sample items loaded' });
                }}
              >
                Load sample items
              </button>
            </div>
          </section>
        )}

        <section className="section-block stack tight" aria-labelledby="erase-title">
          <h2 id="erase-title" className="section-title">
            Start over
          </h2>
          <p>Erases every item, deal and sale on this device.</p>
          <div>
            <button
              type="button"
              className="button danger"
              onClick={() => setConfirmingErase(true)}
            >
              Erase everything
            </button>
          </div>
        </section>
      </div>

      {pendingRestore && (
        <Confirm
          title="Override current setup?"
          message={`The backup has ${plural(pendingRestore.state.items.length, 'item')} and ${plural(pendingRestore.state.sales.length, 'sale')}. It will replace everything currently on this device.`}
          confirmLabel="Replace"
          onConfirm={restore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
      {confirmingErase && (
        <Confirm
          title="Erase everything?"
          message="This can't be undone. Save a backup first if you want to keep anything."
          confirmLabel="Erase"
          onConfirm={erase}
          onCancel={() => setConfirmingErase(false)}
        />
      )}
    </div>
  );
}
