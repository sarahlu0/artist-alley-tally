import { Download, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EventPicker } from '../components/EventPicker';
import { NewEventSheet } from '../components/NewEventSheet';
import { Field, MoneyInput, Sheet, useMoneyText } from '../components/ui';
import { recapCsv, salesCsv } from '../lib/csv';
import { fileSlug, saveFile } from '../lib/files';
import { formatMoney } from '../lib/money';
import { formatDay, formatTime, plural } from '../lib/format';
import { PAYMENT_LABELS } from '../lib/payments';
import { summarizeEvent, type EventRecap, type ItemRecap } from '../lib/stats';
import { useStore } from '../state/store';
import type { TallyEvent } from '../types';
import '../styles/screens.css';

export function RecapScreen() {
  const { state, dispatch } = useStore();
  // null follows the current event, including after a new one starts.
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const eventId = pickedEventId ?? state.currentEventId;
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);

  const recap = useMemo(() => summarizeEvent(state, eventId), [state, eventId]);
  if (!recap) return null;

  const { event } = recap;
  const isCurrent = event.id === state.currentEventId;
  const slug = fileSlug(event.name);

  return (
    <div className="screen">
      <h1 className="page-title">
        Recap <span className="page-title-sub">{event.name}</span>
      </h1>
      <div className="page-body stack recap">
        <div className="row wrap">
          <p className="muted grow">
            {formatDay(event.startedAt)}
            {event.endedAt !== null && ' · ended'}
          </p>
          <button type="button" className="button small" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden="true" /> Event details
          </button>
        </div>
        {state.events.length > 1 && <EventPicker value={eventId} onChange={setPickedEventId} />}

        <section className="recap-hero">
          <h2 className="field-label">Total sales</h2>
          <p className="recap-total money">{formatMoney(recap.revenue)}</p>
          <p>
            {plural(recap.orderCount, 'order')}, {plural(recap.unitsSold, 'item')} sold
          </p>
        </section>

        <Money recap={recap} onEdit={() => setEditing(true)} />

        {recap.orderCount + recap.giveaways.orders === 0 ? (
          <p className="empty">No sales yet.</p>
        ) : (
          <>
            <NextTime items={recap.items} finished={event.endedAt !== null} />
            <WhatSold items={recap.items} />
            <Extras recap={recap} />
          </>
        )}

        <section className="stack tight">
          <button
            type="button"
            className="button wide"
            onClick={() => saveFile(`${slug}-sales.csv`, salesCsv(state, event.id), 'text/csv')}
          >
            <Download size={20} aria-hidden="true" /> Export sales (CSV)
          </button>
          <button
            type="button"
            className="button wide"
            onClick={() => saveFile(`${slug}-items.csv`, recapCsv(recap), 'text/csv')}
          >
            <Download size={20} aria-hidden="true" /> Export item counts (CSV)
          </button>
        </section>

        {isCurrent && (
          <section className="section-block stack tight" aria-labelledby="event-actions">
            <h2 id="event-actions" className="section-title">
              {event.endedAt === null ? 'End of the day' : 'Next event'}
            </h2>
            {event.endedAt === null ? (
              <div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => dispatch({ type: 'event/finish', at: Date.now() })}
                >
                  End event
                </button>
              </div>
            ) : (
              <div className="row wrap">
                <button type="button" className="button primary" onClick={() => setStarting(true)}>
                  Start a new event
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => dispatch({ type: 'event/reopen' })}
                >
                  Reopen this one
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {editing && <EventSheet event={event} onClose={() => setEditing(false)} />}
      {starting && (
        <NewEventSheet
          onClose={() => {
            setStarting(false);
            setPickedEventId(null);
          }}
        />
      )}
    </div>
  );
}

function Money({ recap, onEdit }: { recap: EventRecap; onEdit: () => void }) {
  const used = recap.payments.filter((payment) => payment.count > 0 || payment.method === 'cash');
  return (
    <section className="section-block stack tight" aria-labelledby="money-title">
      <h2 id="money-title" className="section-title">
        By payment
      </h2>
      <ul className="plain-list">
        {used.map((payment) => (
          <li key={payment.method} className="row between">
            <span>
              {PAYMENT_LABELS[payment.method]}
              <span className="small muted"> {plural(payment.count, 'order')}</span>
            </span>
            <span className="money">{formatMoney(payment.total)}</span>
          </li>
        ))}
      </ul>
      <div className="cash-check">
        <p>
          Cash box should hold <strong className="money">{formatMoney(recap.cashExpected)}</strong>
        </p>
        <p className="small muted">
          {recap.event.cashFloat > 0 &&
            `${formatMoney(recap.event.cashFloat)} starting cash + cash sales. `}
          <button type="button" className="link small" onClick={onEdit}>
            {recap.event.cashFloat > 0 ? 'Change' : 'Add starting cash'}
          </button>
        </p>
      </div>
    </section>
  );
}

function NextTime({ items, finished }: { items: ItemRecap[]; finished: boolean }) {
  const soldOut = items.filter((row) => row.soldOutAt !== null);
  // Unsold items are only worth calling out once the event is over.
  const untouched = finished
    ? items.filter((row) => row.brought !== null && row.brought > 0 && row.sold + row.given === 0)
    : [];
  if (soldOut.length === 0 && untouched.length === 0) return null;

  return (
    <section className="section-block stack tight" aria-labelledby="next-time">
      <h2 id="next-time" className="section-title">
        For next time
      </h2>
      {soldOut.length > 0 && (
        <div>
          <h3>Sold out</h3>
          <ul>
            {soldOut.map((row) => (
              <li key={row.itemId}>
                {row.name} <span className="small muted">at {formatTime(row.soldOutAt!)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {untouched.length > 0 && (
        <div>
          <h3>Didn't sell</h3>
          <ul>
            {untouched.map((row) => (
              <li key={row.itemId}>{row.name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function WhatSold({ items }: { items: ItemRecap[] }) {
  const moved = items.filter((row) => row.sold + row.given > 0);
  const still = items.filter((row) => row.sold + row.given === 0);
  return (
    <section className="stack tight">
      <h2>What sold</h2>
      <ul className="sold-list">
        {moved.map((row) => {
          const gone = row.sold + row.given;
          const share = row.brought ? Math.min(1, gone / row.brought) : 0;
          return (
            <li key={row.itemId}>
              <div className="row between">
                <span className="grow">{row.name}</span>
                <span className="money">{formatMoney(row.revenue)}</span>
              </div>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${share * 100}%` }} />
              </div>
              <p className="small muted">
                {row.brought === null ? `${row.sold} sold` : `${row.sold} of ${row.brought} sold`}
                {row.given > 0 && `, ${row.given} traded or free`}
                {row.left !== null && `, ${row.left} left`}
              </p>
            </li>
          );
        })}
      </ul>
      {still.length > 0 && (
        <details className="unsold">
          <summary>No sales yet ({still.length})</summary>
          <ul>
            {still.map((row) => (
              <li key={row.itemId}>
                {row.name}
                {row.left !== null && <span className="small muted"> {row.left} left</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Extras({ recap }: { recap: EventRecap }) {
  const { giveaways } = recap;
  return (
    <>
      {recap.categories.length > 1 && (
        <section className="section-block stack tight" aria-labelledby="by-category">
          <h2 id="by-category" className="section-title">
            By category
          </h2>
          <ul className="plain-list">
            {recap.categories.map((category) => (
              <li key={category.name} className="row between">
                <span>
                  {category.name} <span className="small muted">{category.units} sold</span>
                </span>
                <span className="money">{formatMoney(category.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.deals.length > 0 && (
        <section className="section-block stack tight" aria-labelledby="deals-used">
          <h2 id="deals-used" className="section-title">
            Deals used
          </h2>
          <ul className="plain-list">
            {recap.deals.map((deal) => (
              <li key={deal.name} className="row between">
                <span>
                  {deal.name} <span className="small muted">used {deal.times}×</span>
                </span>
                <span className="small muted">{formatMoney(deal.savings)} off</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(giveaways.orders > 0 || recap.adjustedCount > 0) && (
        <section className="section-block stack tight" aria-labelledby="not-sales">
          <h2 id="not-sales" className="section-title">
            Trades, freebies and changed totals
          </h2>
          {giveaways.orders > 0 && (
            <p>
              {plural(giveaways.units, 'item')} traded or given away (
              <span className="money">{formatMoney(giveaways.value)}</span> value). Not counted in
              total sales.
            </p>
          )}
          {recap.adjustedCount > 0 && (
            <p>{plural(recap.adjustedCount, 'order')} had the total changed by hand.</p>
          )}
        </section>
      )}
    </>
  );
}

function EventSheet({ event, onClose }: { event: TallyEvent; onClose: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(event.name);
  const [floatText, setFloatText, cashFloat] = useMoneyText(event.cashFloat || null);

  function save() {
    dispatch({
      type: 'event/update',
      id: event.id,
      name: name.trim() || event.name,
      cashFloat: cashFloat ?? 0,
    });
    onClose();
  }

  return (
    <Sheet title="Event details" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Event name">
          <input
            className="input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Starting cash">
          <MoneyInput value={floatText} onChange={setFloatText} />
        </Field>
        <button type="submit" className="button primary wide">
          Save
        </button>
      </form>
    </Sheet>
  );
}
