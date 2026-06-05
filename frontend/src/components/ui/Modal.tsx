import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	/** Show the gradient accent bar across the top. */
	accent?: boolean;
	/** Tailwind max-width class for the panel. */
	maxWidth?: string;
	children: ReactNode;
}

// Shared modal shell: backdrop + zoom panel + optional titled header with a
// close button. Replaces the hand-rolled overlay markup duplicated across the
// create-user and add-course dialogs.
export const Modal = ({
	open,
	onClose,
	title,
	accent = false,
	maxWidth = "max-w-md",
	children,
}: ModalProps) => {
	if (!open) return null;
	return (
		<div
			className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
			dir="rtl"
		>
			<div
				className={`bg-white dark:bg-slate-900 rounded-3xl p-8 w-full ${maxWidth} shadow-2xl border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden animate-in zoom-in-95 duration-200`}
			>
				{accent && (
					<div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-3xl"></div>
				)}
				{title && (
					<div className="flex justify-between items-center mb-7">
						<h3 className="text-xl font-black text-slate-900 dark:text-white">
							{title}
						</h3>
						<button
							type="button"
							onClick={onClose}
							className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
						>
							<X size={18} />
						</button>
					</div>
				)}
				{children}
			</div>
		</div>
	);
};
