import { ArrowLeftRight, Banknote, Gift, Wallet, type LucideIcon } from 'lucide-react';
import cardIcon from '../assets/pay/card.png';
import venmoLogo from '../assets/pay/venmo.png';
import zelleLogo from '../assets/pay/zelle.png';
import { PAYMENT_LABELS } from '../lib/payments';
import type { Payment } from '../types';

// Venmo and Zelle have their name in the logo, so the logo is the label.
const LOGOS: Partial<Record<Payment, string>> = { venmo: venmoLogo, zelle: zelleLogo };

const ICONS: Partial<Record<Payment, LucideIcon>> = {
  cash: Banknote,
  other: Wallet,
  trade: ArrowLeftRight,
  gift: Gift,
};

/** What goes inside a payment button: a logo, or an icon with the name beside it. */
export function PaymentMark({ payment }: { payment: Payment }) {
  const logo = LOGOS[payment];
  if (logo) return <img className="pay-logo" src={logo} alt={PAYMENT_LABELS[payment]} />;

  const Icon = ICONS[payment];
  return (
    <span className="pay-mark">
      {payment === 'card' ? (
        <img className="pay-icon" src={cardIcon} alt="" />
      ) : (
        Icon && <Icon className="pay-icon" size={26} aria-hidden="true" />
      )}
      {PAYMENT_LABELS[payment]}
    </span>
  );
}
