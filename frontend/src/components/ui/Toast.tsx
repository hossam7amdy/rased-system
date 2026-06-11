import { AlertCircle, Bell, CheckCircle, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

type ToastType = "info" | "success" | "error" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

type AddToast = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<AddToast | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback<AddToast>(
    (message, type = "info", duration = 4000) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        duration,
      );
    },
    [],
  );

  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 w-full max-w-sm px-4"
        dir="rtl"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-bold transition-all animate-in slide-in-from-top-4 duration-300 ${
              toast.type === "success"
                ? "bg-emerald-50/95 border-emerald-200 text-emerald-800"
                : toast.type === "error"
                  ? "bg-red-50/95 border-red-200 text-red-800"
                  : toast.type === "warning"
                    ? "bg-amber-50/95 border-amber-200 text-amber-800"
                    : "bg-blue-50/95 border-blue-200 text-blue-800"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-500"
                  : toast.type === "error"
                    ? "bg-red-500"
                    : toast.type === "warning"
                      ? "bg-amber-500"
                      : "bg-blue-500"
              } text-white`}
            >
              {toast.type === "success" ? (
                <CheckCircle size={14} />
              ) : toast.type === "error" ? (
                <AlertCircle size={14} />
              ) : (
                <Bell size={14} />
              )}
            </div>
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): AddToast => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};
