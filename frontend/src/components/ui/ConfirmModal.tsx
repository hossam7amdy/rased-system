import { AlertCircle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${danger ? "bg-red-100" : "bg-blue-100"}`}
        >
          <AlertCircle
            className={danger ? "text-red-600" : "text-blue-600"}
            size={28}
          />
        </div>
        <h3 className="text-xl font-black text-gray-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-gray-500 text-center text-sm font-medium mb-8 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-black text-white transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-blue-700 hover:bg-blue-700"}`}
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
};
