import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	id: string;
}

// Labelled text input: the label+input pair (with the repeated input classes)
// used across the create-user and add-course forms. Extra props (type, value,
// onChange, required, placeholder, defaultValue) pass straight through.
export const Field = ({ label, id, className = "", ...rest }: FieldProps) => (
	<div className="space-y-1.5">
		<label
			htmlFor={id}
			className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider"
		>
			{label}
		</label>
		<input
			id={id}
			className={`w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 dark:ring-blue-600 transition-all font-bold text-sm text-slate-800 dark:text-slate-200 ${className}`}
			{...rest}
		/>
	</div>
);
