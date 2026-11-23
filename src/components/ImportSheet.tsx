import { useMemo, useState } from 'react';
import { mergeImport, parseTable, readItemRows } from '../lib/csv';
import { newId } from '../lib/ids';
import { plural } from '../lib/format';
import { useStore } from '../state/store';
import { useToast } from './Toast';
import { ErrorText, Sheet } from './ui';

const EXAMPLE = 'Name\tPrice\tQuantity\tCategory\nFrog sticker\t4\t10\tStickers';
const MAX_FILE_BYTES = 1_000_000;

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState('');

  const { rows, skipped } = useMemo(() => readItemRows(parseTable(text)), [text]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError('That file is too big to be an item list.');
    setFileError('');
    setText(await file.text());
  }

  function importRows() {
    const merged = mergeImport(state, rows, newId);
    dispatch({ type: 'catalog/set', categories: merged.categories, items: merged.items });
    const updated = merged.updated > 0 ? `, ${merged.updated} updated` : '';
    toast({ text: `${plural(merged.added, 'item')} added${updated}` });
    onClose();
  }

  return (
    <Sheet title="Bring in a spreadsheet" onClose={onClose}>
      <div className="stack">
        <p>
          Paste rows from your spreadsheet. Column order:{' '}
          <strong>Name, Price, Quantity, Category</strong>.
        </p>
        <textarea
          className="input"
          rows={7}
          value={text}
          placeholder={EXAMPLE}
          aria-label="Pasted rows"
          onChange={(event) => setText(event.target.value)}
        />
        <label className="button small file-button">
          Choose a .csv file
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="visually-hidden"
            onChange={(event) => readFile(event.target.files?.[0])}
          />
        </label>
        {fileError && <ErrorText>{fileError}</ErrorText>}

        {text.trim() !== '' && (
          <p className={rows.length === 0 ? 'error-text' : 'small'} aria-live="polite">
            {rows.length === 0
              ? 'No items found. Each row needs a name and a price.'
              : `Found ${plural(rows.length, 'item')}.`}
            {skipped > 0 &&
              rows.length > 0 &&
              ` Skipping ${plural(skipped, 'row')} missing a name or price.`}
          </p>
        )}
        <button
          type="button"
          className="button primary wide"
          disabled={rows.length === 0}
          onClick={importRows}
        >
          {rows.length === 0 ? 'Add items' : `Add ${plural(rows.length, 'item')}`}
        </button>
      </div>
    </Sheet>
  );
}
