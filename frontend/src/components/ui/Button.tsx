import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50",
  secondary:
    "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700",
};

// Layout (width, padding) stays the caller's job via className; this only owns
// the variant look + shared font/transition. type defaults to "button".
export const Button = ({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={`rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    {...rest}
  />
);
