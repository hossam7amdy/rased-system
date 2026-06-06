import { GraduationCap, LogOut, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "../../app/ThemeContext";
import { useAuth } from "../../features/auth/AuthContext";
import type { Role } from "../../lib/types";

interface DashboardLayoutProps {
	children: ReactNode;
	title: string;
	subtitle?: string;
}

const roleLabel: Record<Role, string> = {
	admin: "مسؤول النظام",
	professor: "عضو هيئة التدريس",
	student: "طالب",
};
const roleColor: Record<Role, string> = {
	admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
	professor:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
	student:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

export const DashboardLayout = ({
	children,
	title,
	subtitle,
}: DashboardLayoutProps) => {
	const { user, logout } = useAuth();
	const { dark, toggle } = useTheme();
	const role = user?.role;

	return (
		<div
			className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300"
			dir="rtl"
		>
			{/* Header */}
			<header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-[70px]">
					{/* Logo */}
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-300/40">
							<GraduationCap className="text-white w-5 h-5" />
						</div>
						<div className="hidden sm:block">
							<span className="text-sm font-black text-slate-900 dark:text-white leading-none block">
								كلية التربية النوعية
							</span>
							<span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold">
								جامعة المنصورة
							</span>
						</div>
					</div>

					{/* Right side */}
					<div className="flex items-center gap-3">
						{/* Dark mode toggle */}
						<button
							type="button"
							onClick={toggle}
							className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
						>
							{dark ? <Sun size={16} /> : <Moon size={16} />}
						</button>

						{/* User info */}
						<div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-2.5 border border-slate-200/60 dark:border-slate-700/60">
							<div className="w-8 h-8 bg-gradient-to-br from-blue-800 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">
								{user?.full_name?.charAt(0)}
							</div>
							<div className="text-right">
								<p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">
									{user?.full_name}
								</p>
								<span
									className={`text-[10px] font-black px-2 py-0.5 rounded-full ${role ? roleColor[role] : ""}`}
								>
									{role ? roleLabel[role] : ""}
								</span>
							</div>
						</div>

						{/* Logout */}
						<button
							type="button"
							onClick={logout}
							className="group flex items-center gap-2 px-3 py-2.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
							title="تسجيل الخروج"
						>
							<span className="text-sm font-bold hidden sm:block">خروج</span>
							<LogOut
								size={16}
								className="group-hover:translate-x-0.5 transition-transform"
							/>
						</button>
					</div>
				</div>
			</header>

			{/* Page Header */}
			<div className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/40 dark:border-slate-700/40">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
								{title}
							</h1>
							{subtitle && (
								<p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
									{subtitle}
								</p>
							)}
						</div>
						<div className="text-xs text-slate-400 dark:text-slate-500 font-medium bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm hidden sm:block">
							{new Date().toLocaleDateString("ar-EG", {
								weekday: "long",
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</div>
					</div>
				</div>
			</div>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{children}
			</main>
		</div>
	);
};
