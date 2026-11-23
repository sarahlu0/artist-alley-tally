import { Minus } from 'lucide-react';
import { formatMoney } from '../lib/money';
import { stockLevel } from '../state/selectors';
import type { Item } from '../types';
import { useSortableItem } from './Sortable';

interface ItemTileProps {
  item: Item;
  dragDisabled: boolean;
  photo: string | undefined;
  color: string;
  /** Stock minus units in open carts. */
  left: number;
  inCart: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function ItemTile({
  item,
  dragDisabled,
  photo,
  color,
  left,
  inCart,
  onAdd,
  onRemove,
}: ItemTileProps) {
  // Sortable attributes are left off so the card stays a plain button for
  // keyboard and screen reader users.
  const { listeners, setNodeRef, style, isDragging } = useSortableItem(item.id, dragDisabled);
  const level = stockLevel(left);
  // Not sold out if the last units are in the active cart.
  const soldOut = level === 'out' && inCart === 0;
  const stockText = soldOut ? 'Sold out' : `${Math.max(0, left)} left`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="tile"
      data-dragging={isDragging}
      data-in-cart={inCart > 0}
      data-stock={soldOut ? 'out' : level === 'ok' ? 'ok' : 'low'}
    >
      <button
        type="button"
        className="tile-main"
        style={{ borderTopColor: color }}
        onClick={onAdd}
        {...listeners}
      >
        {photo && (
          <span className="tile-art">
            <img src={photo} alt="" />
          </span>
        )}
        <span className="tile-name">{item.name}</span>
        <span className="money tile-price">{formatMoney(item.price)}</span>
        <span className="tile-stock">{stockText}</span>
        {inCart > 0 && <span className="visually-hidden">, {inCart} in order</span>}
      </button>
      {inCart > 0 && (
        <>
          <span className="tile-count" aria-hidden="true" key={inCart}>
            {inCart}
          </span>
          <button
            type="button"
            className="tile-minus"
            onClick={onRemove}
            aria-label={`Remove one ${item.name}`}
          >
            <Minus size={18} strokeWidth={3} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
