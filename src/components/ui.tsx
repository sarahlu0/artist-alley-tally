import { Minus, Plus, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getCurrencySymbol, moneyInputValue, parseMoney } from '../lib/money';
import type { Cents } from '../types';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal window. The browser's <dialog> handles Escape and keeps focus inside;
 * on close, focus goes back to whatever opened it.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first button (the close button). A field marked
      // data-autofocus, like a new category's name, should get focus instead.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    return () => {
      // If what opened the sheet is gone (the order was just logged), land on the page instead.
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
        // A click on the dimmed area lands on the dialog element itself.
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

/** Error messages are announced by screen readers as soon as they appear. */
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

/** A price box. Keeps the raw text so people can type "4.5" without it jumping around. */
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

/** Text state for a MoneyInput plus the parsed amount (null while it isn't a valid price). */
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
  /** Read out for the number box and the +/- buttons, e.g. "In stock". */
  label: string;
  /** Lets a visible <label htmlFor> point at the number box. */
  id?: string;
}

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
          // An empty box mid-edit is not a zero; wait for a real number.
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(next, 9999)));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(value + 1, 9999))}
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
  /** Hide the legend visually when the surrounding screen already says what this is. */
  hideLegend?: boolean;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Pick one, shown as a row of chips. Real radio buttons underneath, so arrow
 * keys and screen readers behave the way people expect.
 */
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
