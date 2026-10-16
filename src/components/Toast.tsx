import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastAction {
  label: string;
  run: () => void;
}
type Show = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Show>((text, action) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  toast.action!.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
