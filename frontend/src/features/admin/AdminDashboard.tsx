import {
	GraduationCap,
	LogOut,
	Moon,
	Plus,
	Shield,
	Sun,
	UserPlus,
	Users,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTheme } from "../../app/ThemeContext";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { useToast } from "../../components/ui/Toast";
import { adminApi, authApi } from "../../lib/api";
import { ApiError } from "../../lib/response.js";
import type { Role, User } from "../../lib/types";
import { useAuth } from "../auth/AuthContext";
import EnrollmentManager from "./EnrollmentManager";

interface NewUserForm {
	full_name: string;
	email: string;
	password: string;
	role: Role;
	student_id: string;
}

const blankForm: NewUserForm = {
	full_name: "",
	email: "",
	password: "",
	role: "student",
	student_id: "",
};

const roleLabel: Record<Role, string> = {
	admin: "مسؤول",
	professor: "دكتور",
	student: "طالب",
};
const roleStyle: Record<Role, string> = {
	admin: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
	professor:
		"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
	student: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
};

const navItems = [
	{ key: "overview" as const, label: "إدارة المستخدمين", icon: Users },
	{ key: "enrollment" as const, label: "ربط الطلاب بالمواد", icon: UserPlus },
];

const textFields = [
	{
		label: "الاسم الكامل",
		field: "full_name",
		type: "text",
		placeholder: "محمد أحمد علي",
	},
	{
		label: "البريد الإلكتروني",
		field: "email",
		type: "email",
		placeholder: "user@example.com",
	},
	{
		label: "كلمة المرور",
		field: "password",
		type: "password",
		placeholder: "••••••••",
	},
] as const;

export const AdminDashboard = () => {
	const { user, logout } = useAuth();
	const { dark, toggle } = useTheme();
	const addToast = useToast();
	const [users, setUsers] = useState<User[]>([]);
	const [showModal, setShowModal] = useState(false);
	const [activeTab, setActiveTab] = useState<"overview" | "enrollment">(
		"overview",
	);
	const [loading, setLoading] = useState(true);
	const [formData, setFormData] = useState<NewUserForm>({ ...blankForm });

	const fetchUsers = useCallback(async () => {
		try {
			const { users: list } = await adminApi.users();
			setUsers(list);
		} catch {
			addToast("فشل في تحميل المستخدمين", "error");
		} finally {
			setLoading(false);
		}
	}, [addToast]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleCreateUser = async (e: FormEvent) => {
		e.preventDefault();
		try {
			await authApi.register({
				fullName: formData.full_name,
				email: formData.email,
				password: formData.password,
				role: formData.role,
				studentId: formData.student_id,
			});
			setShowModal(false);
			fetchUsers();
			setFormData({ ...blankForm });
			addToast("تم إنشاء الحساب بنجاح", "success");
		} catch (err) {
			addToast(
				err instanceof ApiError ? err.message : "خطأ في العملية",
				"error",
			);
		}
	};

	const stats = [
		{
			label: "طلاب",
			value: users.filter((u) => u.role === "student").length,
			color: "blue",
			icon: Users,
		},
		{
			label: "دكاترة",
			value: users.filter((u) => u.role === "professor").length,
			color: "amber",
			icon: GraduationCap,
		},
		{
			label: "مسؤولون",
			value: users.filter((u) => u.role === "admin").length,
			color: "purple",
			icon: Shield,
		},
	] as const;

	return (
		<div
			className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-300"
			dir="rtl"
		>
			{/* Sidebar */}
			<aside className="w-full md:w-72 bg-white dark:bg-slate-900 border-l border-slate-200/60 dark:border-slate-700/60 shadow-sm flex-shrink-0 flex flex-col">
				{/* Logo */}
				<div className="p-8 border-b border-slate-100 dark:border-slate-800">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-11 h-11 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50">
							<GraduationCap className="text-white" size={22} />
						</div>
						<div>
							<p className="text-sm font-black text-slate-900 dark:text-white leading-none">
								كلية التربية النوعية
							</p>
							<p className="text-[11px] text-blue-700 dark:text-blue-400 font-bold">
								جامعة المنصورة
							</p>
						</div>
					</div>
					<div className="mt-5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-3">
						<div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md">
							{user?.full_name?.charAt(0)}
						</div>
						<div>
							<p className="text-xs font-black text-slate-800 dark:text-slate-200">
								{user?.full_name}
							</p>
							<span className="text-[10px] font-black text-blue-700 dark:text-blue-400">
								مسؤول النظام
							</span>
						</div>
					</div>
				</div>

				{/* Nav */}
				<nav className="flex-1 p-5 space-y-1.5">
					{navItems.map((item) => (
						<button
							type="button"
							key={item.key}
							onClick={() => setActiveTab(item.key)}
							className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm transition-all ${
								activeTab === item.key
									? "bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50"
									: "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200"
							}`}
						>
							<item.icon size={18} />
							{item.label}
						</button>
					))}
				</nav>

				{/* Bottom */}
				<div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-2">
					<button
						type="button"
						onClick={toggle}
						className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
					>
						{dark ? <Sun size={18} /> : <Moon size={18} />}
						{dark ? "الوضع النهاري" : "الوضع الليلي"}
					</button>
					<button
						type="button"
						onClick={logout}
						className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
					>
						<LogOut size={18} /> تسجيل الخروج
					</button>
				</div>
			</aside>

			{/* Main */}
			<main className="flex-1 p-6 md:p-10 overflow-y-auto">
				<div className="max-w-5xl mx-auto">
					{activeTab === "overview" && (
						<div className="animate-in fade-in duration-300">
							{/* Header */}
							<div className="flex items-center justify-between mb-8 flex-wrap gap-4">
								<div>
									<h2 className="text-2xl font-black text-slate-900 dark:text-white">
										إدارة المستخدمين
									</h2>
									<p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
										التحكم في حسابات الطلاب والدكاترة
									</p>
								</div>
								<div className="flex items-center gap-3">
									<div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
										<div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl flex items-center justify-center font-black text-sm">
											{users.length}
										</div>
										<p className="text-xs font-black text-slate-700 dark:text-slate-300">
											مستخدم مسجل
										</p>
									</div>
									<button
										type="button"
										onClick={() => setShowModal(true)}
										className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
									>
										<Plus size={18} /> إضافة مستخدم
									</button>
								</div>
							</div>

							{/* Stats */}
							<div className="grid grid-cols-3 gap-4 mb-8">
								{stats.map((s) => (
									<StatCard key={s.label} {...s} />
								))}
							</div>

							{/* Table */}
							<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
								{loading ? (
									<div className="p-8 space-y-4">
										{["a", "b", "c", "d"].map((k) => (
											<Skeleton key={k} className="h-14" />
										))}
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-right">
											<thead>
												<tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
													{[
														"المستخدم",
														"الصلاحية",
														"البريد الإلكتروني",
														"الرقم التعريفي",
													].map((h) => (
														<th
															key={h}
															className="p-4 text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest whitespace-nowrap"
														>
															{h}
														</th>
													))}
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
												{users.map((u) => (
													<tr
														key={u.id}
														className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group"
													>
														<td className="p-4">
															<div className="flex items-center gap-3">
																<div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-700 group-hover:text-white text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center font-black text-xs transition-all">
																	{u.full_name?.charAt(0)}
																</div>
																<span className="font-black text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">
																	{u.full_name}
																</span>
															</div>
														</td>
														<td className="p-4">
															<span
																className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${roleStyle[u.role]}`}
															>
																{roleLabel[u.role]}
															</span>
														</td>
														<td
															className="p-4 text-slate-500 dark:text-slate-400 text-xs font-medium"
															dir="ltr"
														>
															{u.email}
														</td>
														<td className="p-4 font-mono text-xs text-slate-400 dark:text-slate-500">
															{u.student_id || "N/A"}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					)}

					{activeTab === "enrollment" && (
						<div className="animate-in fade-in duration-300">
							<div className="mb-8">
								<h2 className="text-2xl font-black text-slate-900 dark:text-white">
									ربط الطلاب بالمواد
								</h2>
								<p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
									إدارة تسجيل الطلاب في المواد الدراسية
								</p>
							</div>
							<EnrollmentManager />
						</div>
					)}
				</div>
			</main>

			{/* Create User Modal */}
			<Modal
				open={showModal}
				onClose={() => setShowModal(false)}
				title="إضافة مستخدم جديد"
				accent
			>
				<form onSubmit={handleCreateUser} className="space-y-4">
					{textFields.map(({ label, field, type, placeholder }) => (
						<Field
							key={field}
							id={field}
							label={label}
							type={type}
							placeholder={placeholder}
							value={formData[field]}
							onChange={(e) =>
								setFormData({ ...formData, [field]: e.target.value })
							}
							required
						/>
					))}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<label
								htmlFor="new-user-role"
								className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider"
							>
								الصلاحية
							</label>
							<select
								id="new-user-role"
								className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-black text-blue-700 dark:text-blue-400 text-sm"
								value={formData.role}
								onChange={(e) =>
									setFormData({ ...formData, role: e.target.value as Role })
								}
							>
								<option value="student">طالب</option>
								<option value="professor">دكتور</option>
								<option value="admin">مسؤول</option>
							</select>
						</div>
						{formData.role === "student" && (
							<Field
								id="new-user-student-id"
								label="الرقم الجامعي"
								type="text"
								placeholder="ST-000"
								value={formData.student_id}
								onChange={(e) =>
									setFormData({ ...formData, student_id: e.target.value })
								}
								required
							/>
						)}
					</div>
					<div className="flex gap-3 pt-2">
						<Button type="submit" className="flex-[2] py-4">
							إنشاء الحساب
						</Button>
						<Button
							variant="secondary"
							onClick={() => setShowModal(false)}
							className="flex-1 py-4"
						>
							إلغاء
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
};
