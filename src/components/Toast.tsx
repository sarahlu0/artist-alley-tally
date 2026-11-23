import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface ToastMessage {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ToastContext = createContext<(message: ToastMessage) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

const VISIBLE_MS = 6000;
const TICK_MS = 100;

interface ToastViewProps {
  toast: ToastMessage;
  onDone: () => void;
}

/**
 * One countdown drives the visible seconds, the progress bar and dismissal. It
 * keeps running on hover and pauses only while the action button has keyboard
 * focus. Clicking anywhere outside the button dismisses the toast.
 */
function ToastView({ toast, onDone }: ToastViewProps) {
  const [remaining, setRemaining] = useState(VISIBLE_MS);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setRemaining((left) => left - TICK_MS), TICK_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (remaining <= 0) onDone();
  }, [remaining, onDone]);

  return (
    <div
      className="toast"
      role="status"
      onClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest('button'))) onDone();
      }}
    >
      <span>{toast.text}</span>
      {toast.onAction && (
        <button
          type="button"
          onFocus={(event) => setPaused(event.target.matches(':focus-visible'))}
          onBlur={() => setPaused(false)}
          onClick={() => {
            toast.onAction?.();
            onDone();
          }}
        >
          {toast.actionLabel}
          {/* Hidden so the status region doesn't announce every tick. */}
          <span className="toast-count" aria-hidden="true">
            {Math.max(1, Math.ceil(remaining / 1000))}
          </span>
        </button>
      )}
      <span className="toast-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0, remaining / VISIBLE_MS)})` }} />
      </span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastMessage & { key: number }) | null>(null);

  const show = useCallback((message: ToastMessage) => {
    setToast({ ...message, key: Date.now() });
  }, []);
  const hide = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.key} toast={toast} onDone={hide} />}
    </ToastContext.Provider>
  );
}
