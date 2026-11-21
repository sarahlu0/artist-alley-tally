import { useState } from 'react';
import { EventPicker } from '../components/EventPicker';
import { useToast } from '../components/Toast';
import { ChoiceGroup, Sheet } from '../components/ui';
import { newId } from '../lib/ids';
import { formatMoney } from '../lib/money';
import { formatTime, isFree, PAYMENT_LABELS, plural } from '../lib/payments';
import { getCurrentEvent } from '../state/selectors';
import { useStore } from '../state/store';
import { MONEY_METHODS, type Payment, type Sale } from '../types';
import '../styles/screens.css';

const ALL_PAYMENTS: Payment[] = [...MONEY_METHODS, 'trade', 'gift'];

function describeLines(sale: Sale): string {
  return sale.lines
    .map((line) => (line.qty > 1 ? `${line.qty}× ${line.name}` : line.name))
    .join(', ');
}

export function SalesScreen({ onGoToSell }: { onGoToSell: () => void }) {
  const { state } = useStore();
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const eventId = pickedEventId ?? state.currentEventId;
  const [filter, setFilter] = useState<Payment | 'all'>('all');
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  const sales = state.sales.filter((sale) => sale.eventId === eventId);
  const used = ALL_PAYMENTS.filter((payment) => sales.some((sale) => sale.payment === payment));
  const shown = filter === 'all' ? sales : sales.filter((sale) => sale.payment === filter);
  const shownTotal = shown.reduce((total, sale) => total + sale.total, 0);
  const openSale = state.sales.find((sale) => sale.id === openSaleId);

  return (
    <div className="screen">
      <h1 className="page-title">Sales</h1>
      <div className="page-body stack">
        <EventPicker value={eventId} onChange={setPickedEventId} />

        {sales.length === 0 ? (
          <p className="empty">No sales yet.</p>
        ) : (
          <div className="stack">
            <div className="chips" role="group" aria-label="Filter by payment">
              <button
                type="button"
                className="chip"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              {used.map((payment) => (
                <button
                  key={payment}
                  type="button"
                  className="chip"
                  aria-pressed={filter === payment}
                  onClick={() => setFilter(payment)}
                >
                  {PAYMENT_LABELS[payment]}
                </button>
              ))}
            </div>
            <p className="muted">
              {plural(shown.length, 'order')},{' '}
              <span className="money">{formatMoney(shownTotal)}</span>
            </p>
            <ul className="rows">
              {shown.map((sale) => (
                <li key={sale.id}>
                  <button
                    type="button"
                    className="row-button sale-row"
                    onClick={() => setOpenSaleId(sale.id)}
                  >
                    <span className="small muted sale-time">{formatTime(sale.at)}</span>
                    <span className="grow">
                      {describeLines(sale)}
                      {sale.adjusted && <span className="tag">Total changed</span>}
                    </span>
                    <span className={isFree(sale.payment) ? 'tag' : 'tag green'}>
                      {PAYMENT_LABELS[sale.payment]}
                    </span>
                    <span className="money row-price">{formatMoney(sale.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {openSale && (
        <SaleSheet sale={openSale} onClose={() => setOpenSaleId(null)} onReopened={onGoToSell} />
      )}
    </div>
  );
}

interface SaleSheetProps {
  sale: Sale;
  onClose: () => void;
  onReopened: () => void;
}

/** Look at one order, fix how it was paid, or take it back. */
function SaleSheet({ sale, onClose, onReopened }: SaleSheetProps) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const event = getCurrentEvent(state);
  const canReopen = sale.eventId === event.id && event.endedAt === null;

  // Deleting is immediate; the toast's Undo puts the order back exactly as it was.
  function remove() {
    dispatch({ type: 'sale/delete', id: sale.id });
    onClose();
    toast({
      text: 'Order deleted',
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'sale/restore', sale }),
    });
  }

  return (
    <Sheet title={`Order at ${formatTime(sale.at)}`} onClose={onClose}>
      <div className="stack">
        <ul className="plain-list">
          {sale.lines.map((line) => (
            <li key={line.itemId} className="row between">
              <span>
                {line.qty}× {line.name}
              </span>
              <span className="money">{formatMoney(line.qty * line.unitPrice)}</span>
            </li>
          ))}
          {sale.deals.map((deal) => (
            <li key={deal.dealId} className="row between">
              <span>{deal.name}</span>
              <span className="money">-{formatMoney(deal.savings)}</span>
            </li>
          ))}
          <li className="row between total-line">
            <span>{sale.adjusted ? 'Total (changed)' : 'Total'}</span>
            <span className="money">{formatMoney(sale.total)}</span>
          </li>
        </ul>

        <ChoiceGroup
          legend="Paid with"
          value={sale.payment}
          onChange={(payment) => dispatch({ type: 'sale/setPayment', id: sale.id, payment })}
          choices={ALL_PAYMENTS.map((payment) => ({
            value: payment,
            label: PAYMENT_LABELS[payment],
          }))}
        />

        {canReopen && (
          <button
            type="button"
            className="button wide"
            onClick={() => {
              dispatch({ type: 'sale/reopen', id: sale.id, cartId: newId() });
              onClose();
              onReopened();
            }}
          >
            Edit items
          </button>
        )}
        <button type="button" className="button danger wide" onClick={remove}>
          Delete order
        </button>
      </div>
    </Sheet>
  );
}
