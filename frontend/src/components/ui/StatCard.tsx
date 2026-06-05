import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type StatColor = "blue" | "emerald" | "amber" | "purple" | "rose";

interface StatCardProps {
	icon: LucideIcon;
	label: string;
	value: ReactNode;
	color?: StatColor;
	trend?: number;
}

const colors: Record<StatColor, string> = {
	blue: "from-blue-600 to-blue-500 shadow-blue-200/60 dark:shadow-blue-900/50",
	emerald:
		"from-teal-400 to-emerald-500 shadow-teal-200/60 dark:shadow-teal-900/50",
	amber:
		"from-amber-400 to-orange-400 shadow-amber-200/60 dark:shadow-amber-900/50",
	purple:
		"from-cyan-400 to-cyan-600 shadow-cyan-200/60 dark:shadow-cyan-900/50",
	rose: "from-rose-400 to-pink-500 shadow-rose-200/60 dark:shadow-rose-900/50",
};

export const StatCard = ({
	icon: Icon,
	label,
	value,
	color = "blue",
	trend,
}: StatCardProps) => {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-lg dark:hover:shadow-slate-800/50 transition-all duration-300 group">
			<div className="flex items-start justify-between mb-5">
				<div
					className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[color]} shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
				>
					<Icon className="text-white" size={22} />
				</div>
				{trend && (
					<span
						className={`text-xs font-black px-2.5 py-1 rounded-full ${trend > 0 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}
					>
						{trend > 0 ? "+" : ""}
						{trend}%
					</span>
				)}
			</div>
			<p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2">
				{value}
			</p>
			<p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
				{label}
			</p>
		</div>
	);
};
