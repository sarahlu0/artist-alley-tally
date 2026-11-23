import { Minus, Plus, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getCurrencySymbol, moneyInputValue, parseMoney } from '../lib/money';
import type { Cents } from '../types';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A modal <dialog>. Escape and focus trapping are native; focus returns to the opener on close. */
export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element, which is the close button.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    return () => {
      // The opener may be gone, e.g. the cart was emptied by logging the order.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      else document.getElementById('content')?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Backdrop clicks target the <dialog> itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="page-title">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** A label wrapped around exactly one control. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="error-text" role="alert">
      {children}
    </p>
  );
}

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

/** Controlled by raw text so partial input like "4." isn't reformatted mid-typing. */
export function MoneyInput({ value, onChange, id, autoFocus, ariaLabel }: MoneyInputProps) {
  return (
    <span className="money-input">
      <span aria-hidden="true">{getCurrencySymbol()}</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}

/** Returns [text, setText, parsed cents or null if the text isn't a valid price]. */
export function useMoneyText(
  initial: Cents | null,
): [string, (text: string) => void, Cents | null] {
  const [text, setText] = useState(initial === null ? '' : moneyInputValue(initial));
  return [text, setText, parseMoney(text)];
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Accessible name for the input and the +/- buttons. */
  label: string;
  /** Set when a visible <label htmlFor> names the input instead of `label`. */
  id?: string;
}

const STEPPER_MAX = 9999;

export function Stepper({ value, onChange, min = 0, label, id }: StepperProps) {
  return (
    <span className="stepper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        aria-label={id ? undefined : label}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          // Ignore an empty field mid-edit instead of treating it as 0.
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(next, STEPPER_MAX)));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(value + 1, STEPPER_MAX))}
        aria-label={`Increase ${label}`}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </span>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  hideLegend?: boolean;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Radio buttons styled as chips, so arrow keys and screen readers work natively. */
export function ChoiceGroup<T extends string>({
  legend,
  hideLegend,
  choices,
  value,
  onChange,
  className = 'chips wrap',
}: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="choice-group">
      <legend className={hideLegend ? 'visually-hidden' : 'field-label'}>{legend}</legend>
      <div className={className}>
        {choices.map((choice) => (
          <label key={choice.value} className="chip">
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <div className="stack">
        <p>{message}</p>
        <div className="row">
          <button type="button" className="button grow" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button danger grow" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
