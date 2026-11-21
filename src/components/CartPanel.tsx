import { Pause, Trash2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { chargeFor, priceCart } from '../lib/deals';
import { newId } from '../lib/ids';
import { formatMoney, parseMoney } from '../lib/money';
import { isFree, PAYMENT_LABELS, plural } from '../lib/payments';
import { countUnits, getActiveCart } from '../state/selectors';
import { useStore } from '../state/store';
import type { MoneyMethod, Payment } from '../types';
import { PaymentMark } from './PaymentMark';
import { useToast } from './Toast';
import { MoneyInput, Stepper } from './ui';

const MONEY_BUTTONS: MoneyMethod[] = ['cash', 'venmo', 'zelle', 'card', 'other'];
const FREE_BUTTONS: Payment[] = ['trade', 'gift'];

interface CartPanelProps {
  /** Called after an order is logged or put on hold, so a phone sheet can close. */
  onDone?: () => void;
}

/** The open order: what's in it, what it costs, and the buttons that log it. */
export function CartPanel({ onDone }: CartPanelProps) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const cart = getActiveCart(state);
  const [typedTotal, setTypedTotal] = useState<string | null>(null);
  const holdNameId = useId();
  const logAsId = useId();
  const logFreeId = useId();

  const pricing = useMemo(
    () => priceCart(cart.lines, state.items, state.deals),
    [cart.lines, state.items, state.deals],
  );
  const itemsById = useMemo(
    () => new Map(state.items.map((item) => [item.id, item])),
    [state.items],
  );
  const held = state.carts.filter((other) => other.id !== cart.id && other.lines.length > 0);
  const total = chargeFor(cart, pricing);
  const units = countUnits(cart);
  // Changing the items wipes a typed total, so the box closes itself when that happens.
  const editingTotal =
    typedTotal !== null && (cart.customTotal !== null || parseMoney(typedTotal) === null);

  function log(payment: Payment) {
    const saleId = newId();
    const charged = isFree(payment) ? 0 : total;
    dispatch({ type: 'sale/complete', saleId, payment, at: Date.now(), newCartId: newId() });
    setTypedTotal(null);
    toast({
      text: `Logged ${formatMoney(charged)} · ${PAYMENT_LABELS[payment]}`,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'sale/reopen', id: saleId, cartId: newId() }),
    });
    onDone?.();
  }

  function changeTypedTotal(text: string) {
    setTypedTotal(text);
    dispatch({ type: 'cart/setCustomTotal', total: text.trim() === '' ? null : parseMoney(text) });
  }

  function stopTypingTotal() {
    setTypedTotal(null);
    dispatch({ type: 'cart/setCustomTotal', total: null });
  }

  return (
    <div className="cart">
      {units > 0 && (
        <div className="cart-head">
          <span className="cart-count">{plural(units, 'item')}</span>
          <button
            type="button"
            className="button small"
            onClick={() => {
              setTypedTotal(null);
              dispatch({ type: 'cart/clear' });
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Clear
          </button>
        </div>
      )}

      {held.length > 0 && (
        <section className="cart-held" aria-labelledby={`${holdNameId}-held`}>
          <h3 id={`${holdNameId}-held`} className="field-label">
            On hold
          </h3>
          <div className="chips wrap">
            {held.map((other) => (
              <button
                key={other.id}
                type="button"
                className="chip"
                onClick={() => {
                  setTypedTotal(null);
                  dispatch({ type: 'cart/switch', id: other.id });
                }}
              >
                <Pause size={14} aria-hidden="true" />
                {other.label || plural(countUnits(other), 'item')}
                <span className="money">
                  {formatMoney(chargeFor(other, priceCart(other.lines, state.items, state.deals)))}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {units === 0 ? (
        <p className="cart-empty">Tap an item to start an order.</p>
      ) : (
        <>
          <ul className="cart-lines">
            {cart.lines.map((line) => {
              const item = itemsById.get(line.itemId);
              if (!item) return null;
              return (
                <li key={line.itemId}>
                  <span className="grow">{item.name}</span>
                  <Stepper
                    value={line.qty}
                    label={item.name}
                    onChange={(qty) => dispatch({ type: 'cart/setQty', itemId: item.id, qty })}
                  />
                  <span className="money cart-line-price">
                    {formatMoney(item.price * line.qty)}
                  </span>
                </li>
              );
            })}
          </ul>

          {(pricing.applied.length > 0 || pricing.nudges.length > 0) && (
            <div className="cart-deals">
              {pricing.applied.map((deal) => (
                <div key={deal.dealId} className="row between">
                  <span>
                    {deal.name}
                    {deal.times > 1 && ` ×${deal.times}`}
                  </span>
                  <span className="money">-{formatMoney(deal.savings)}</span>
                </div>
              ))}
              {pricing.nudges.map((nudge) => (
                <p key={nudge} className="small muted">
                  {nudge}
                </p>
              ))}
            </div>
          )}

          <div className="cart-total">
            <div className="row between">
              <span>Total</span>
              <span className="money">{formatMoney(total)}</span>
            </div>
            {cart.customTotal !== null && cart.customTotal !== pricing.total && (
              <p className="small muted">Usually {formatMoney(pricing.total)}</p>
            )}
            {!editingTotal ? (
              <button type="button" className="link small" onClick={() => setTypedTotal('')}>
                Change total
              </button>
            ) : (
              <div className="row">
                <MoneyInput
                  value={typedTotal ?? ''}
                  onChange={changeTypedTotal}
                  ariaLabel="New total"
                  autoFocus
                />
                <button type="button" className="button small" onClick={stopTypingTotal}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="cart-pay">
            <section aria-labelledby={logAsId}>
              <h3 id={logAsId} className="field-label">
                Log as
              </h3>
              <div className="pay-grid">
                {MONEY_BUTTONS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`button pay pay-${method}`}
                    onClick={() => log(method)}
                  >
                    <PaymentMark payment={method} />
                  </button>
                ))}
              </div>
            </section>
            <section aria-labelledby={logFreeId}>
              <h3 id={logFreeId} className="field-label">
                Log as {formatMoney(0)}
              </h3>
              <div className="pay-free">
                {FREE_BUTTONS.map((payment) => (
                  <button
                    key={payment}
                    type="button"
                    className="button pay-small"
                    onClick={() => log(payment)}
                  >
                    <PaymentMark payment={payment} />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <form
            className="cart-hold"
            onSubmit={(event) => {
              event.preventDefault();
              setTypedTotal(null);
              dispatch({ type: 'cart/hold', newCartId: newId() });
              onDone?.();
            }}
          >
            <label className="visually-hidden" htmlFor={holdNameId}>
              Name for this order
            </label>
            <input
              id={holdNameId}
              className="input"
              value={cart.label}
              placeholder="Name (optional)"
              maxLength={30}
              autoComplete="off"
              onChange={(event) => dispatch({ type: 'cart/rename', label: event.target.value })}
            />
            <button type="submit" className="button">
              <Pause size={18} aria-hidden="true" />
              Hold
            </button>
          </form>
        </>
      )}
    </div>
  );
}
