import axios from "axios";
import { Html5Qrcode } from "html5-qrcode";
import {
	AlertCircle,
	ArrowRight,
	BarChart2,
	Bell,
	BookOpen,
	Calendar,
	Camera,
	CheckCircle,
	ChevronRight,
	Clock,
	Download,
	GraduationCap,
	Loader,
	LogOut,
	Moon,
	Plus,
	QrCode,
	Search,
	Shield,
	Sun,
	Trash2,
	UserPlus,
	Users,
	UserX,
	X,
	Zap,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useNavigate,
} from "react-router-dom";
import { ThemeProvider, useTheme } from "./app/ThemeContext";
import EnrollmentManager from "./components/Admin/EnrollmentManager";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { Skeleton } from "./components/ui/Skeleton";
import { StatCard } from "./components/ui/StatCard";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { ProfessorDashboard } from "./features/professor/ProfessorDashboard";
import { StudentDashboard } from "./features/student/StudentDashboard";

// --- Configuration ---
const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_URL = `${API_BASE_URL}/api`;
axios.defaults.baseURL = API_URL;
// ==============================
// DYNAMIC QR DISPLAY
// ==============================
const DynamicQRDisplay = ({ course, sessionId }) => {
	const [qrValue, setQrValue] = useState("");
	const [timer, setTimer] = useState(8);
	const [attendedStudents, setAttendedStudents] = useState([]);
	const [isConnected, setIsConnected] = useState(false);
	const _addToast = useToast();

	// Poll QR token every 3s; server auto-rotates every 8s
	useEffect(() => {
		let cancelled = false;
		const fetchQR = async () => {
			try {
				const res = await axios.get(`/attendance/current-qr/${course.id}`);
				if (cancelled) return;
				const { token, remainingSeconds } = res.data.data;
				setIsConnected(true);
				setTimer(remainingSeconds);
				const url = await QRCode.toDataURL(token, {
					width: 400,
					margin: 2,
					color: { dark: "#1E3A8A", light: "#ffffff" },
					errorCorrectionLevel: "H",
				});
				if (!cancelled) setQrValue(url);
			} catch {
				if (!cancelled) setIsConnected(false);
			}
		};
		fetchQR();
		const qrInterval = setInterval(fetchQR, 3000);
		return () => {
			cancelled = true;
			clearInterval(qrInterval);
		};
	}, [course.id]);

	// Poll session attendance list every 5s
	useEffect(() => {
		if (!sessionId) return;
		let cancelled = false;
		const fetchAttendance = async () => {
			try {
				const res = await axios.get(`/attendance/sessions/${sessionId}`);
				if (cancelled) return;
				const records = res.data.data?.records ?? [];
				setAttendedStudents(
					records.map((r) => ({
						studentName: r.full_name,
						studentUniversityId: r.university_id,
						scannedAt: r.scanned_at,
						attendanceStats: { percentage: r.attendance_percentage },
					})),
				);
			} catch {}
		};
		fetchAttendance();
		const attInterval = setInterval(fetchAttendance, 5000);
		return () => {
			cancelled = true;
			clearInterval(attInterval);
		};
	}, [sessionId]);

	useEffect(() => {
		const interval = setInterval(() => {
			setTimer((prev) => (prev <= 1 ? 8 : prev - 1));
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const timerPct = (timer / 8) * 100;
	const timerColor =
		timer <= 2 ? "bg-rose-400" : timer <= 4 ? "bg-amber-400" : "bg-blue-700";

	return (
		<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
			{/* QR Panel */}
			<div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
				{/* Top bar */}
				<div className="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2.5">
							<div
								className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
							></div>
							<span
								className={`text-xs font-black ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
							>
								{isConnected ? "متصل بالخادم" : "غير متصل"}
							</span>
						</div>
						<div className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400">
							<Zap size={14} />
							<span>تحديث كل 8 ثوانٍ</span>
						</div>
					</div>
					<h2 className="text-2xl font-black text-slate-900 dark:text-white">
						{course.course_name}
					</h2>
					<p className="text-slate-400 dark:text-slate-500 text-sm font-bold mt-1">
						كود المادة:{" "}
						<span className="font-mono text-blue-700 dark:text-blue-400">
							{course.course_code}
						</span>
					</p>
				</div>

				<div className="p-8 flex flex-col items-center">
					{/* QR Container */}
					<div className="relative mb-8">
						<div className="absolute inset-0 bg-gradient-to-br from-blue-700/20 to-blue-600/20 rounded-[2rem] blur-2xl scale-110"></div>
						<div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-2xl border-4 border-slate-100 dark:border-slate-700">
							{qrValue ? (
								<img
									src={qrValue}
									alt="QR Code"
									className="w-64 h-64 rounded-xl"
								/>
							) : (
								<div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
									<div className="relative">
										<div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
										<div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
									</div>
									<p className="text-sm font-bold text-slate-400 dark:text-slate-500">
										في انتظار التوكن...
									</p>
								</div>
							)}
						</div>
						{/* Corner decorators */}
						{qrValue &&
							[
								"top-2 right-2",
								"top-2 left-2",
								"bottom-2 right-2",
								"bottom-2 left-2",
							].map((pos, i) => (
								<div
									key={i}
									className={`absolute ${pos} w-6 h-6 border-2 border-blue-600 dark:border-blue-500 rounded-sm opacity-60`}
									style={{
										borderWidth: i < 2 ? "3px 3px 0 0" : "0 0 3px 3px",
										transform: i === 1 || i === 2 ? "scaleX(-1)" : "none",
									}}
								/>
							))}
					</div>

					{/* Timer */}
					<div className="w-full max-w-xs">
						<div className="flex justify-between mb-2 text-xs font-black px-1">
							<span className="text-slate-400 dark:text-slate-500">
								تحديث الكود
							</span>
							<span
								className={`font-mono text-base ${timer <= 2 ? "text-rose-500" : "text-blue-700 dark:text-blue-400"}`}
							>
								{timer}s
							</span>
						</div>
						<div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
							<div
								className={`h-full ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
								style={{ width: `${timerPct}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Live Attendance Feed */}
			<div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col">
				<div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-black text-slate-900 dark:text-white">
							الحضور المباشر
						</h3>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
							<span className="bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-black px-3 py-1.5 rounded-full">
								{attendedStudents.length} طالب
							</span>
						</div>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
					{attendedStudents.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full py-16 text-center">
							<div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
								<Users
									size={28}
									className="text-slate-300 dark:text-slate-600"
								/>
							</div>
							<p className="text-slate-400 dark:text-slate-500 font-bold text-sm">
								في انتظار الطلاب...
							</p>
							<p className="text-slate-300 dark:text-slate-600 text-xs font-medium mt-1">
								سيظهر اسم كل طالب هنا فور مسحه للكود
							</p>
						</div>
					) : (
						attendedStudents.map((s, i) => (
							<div
								key={i}
								className="group flex items-center gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl animate-in slide-in-from-right-4 duration-300"
							>
								<div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/50 flex-shrink-0">
									{s.studentName?.charAt(0) || "؟"}
								</div>
								<div className="flex-1 min-w-0 text-right">
									<p className="font-black text-slate-800 dark:text-slate-200 text-sm truncate">
										{s.studentName || "غير معروف"}
									</p>
									<div className="flex items-center gap-2 mt-0.5">
										{s.studentUniversityId && (
											<span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
												{s.studentUniversityId}
											</span>
										)}
										<span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
											{new Date(s.scannedAt).toLocaleTimeString("ar-EG", {
												hour: "2-digit",
												minute: "2-digit",
												second: "2-digit",
											})}
										</span>
									</div>
									{s.attendanceStats && (
										<div className="mt-1.5 flex items-center gap-1.5">
											<div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full ${s.attendanceStats.percentage >= 75 ? "bg-emerald-400" : s.attendanceStats.percentage >= 50 ? "bg-amber-400" : "bg-red-400"}`}
													style={{ width: `${s.attendanceStats.percentage}%` }}
												/>
											</div>
											<span
												className={`text-[10px] font-black ${s.attendanceStats.percentage >= 75 ? "text-emerald-600 dark:text-emerald-400" : s.attendanceStats.percentage >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}
											>
												{s.attendanceStats.percentage}%
											</span>
										</div>
									)}
								</div>
								<CheckCircle
									size={18}
									className="text-emerald-500 flex-shrink-0"
								/>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
};
// ==============================
// ADMIN DASHBOARD
// ==============================
const AdminDashboard = () => {
	const { user, logout } = useAuth();
	const { dark, toggle } = useTheme();
	const addToast = useToast();
	const [users, setUsers] = useState([]);
	const [showModal, setShowModal] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");
	const [loading, setLoading] = useState(true);
	const [formData, setFormData] = useState({
		full_name: "",
		email: "",
		password: "",
		role: "student",
		student_id: "",
	});
	const [_confirmDelete, _setConfirmDelete] = useState(null);

	const fetchUsers = useCallback(async () => {
		try {
			const res = await axios.get("/admin/users");
			setUsers(res.data.data.users);
		} catch {
			addToast("فشل في تحميل المستخدمين", "error");
		} finally {
			setLoading(false);
		}
	}, [addToast]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleCreateUser = async (e) => {
		e.preventDefault();
		try {
			await axios.post("/auth/register", {
				fullName: formData.full_name,
				email: formData.email,
				password: formData.password,
				role: formData.role,
				studentId: formData.student_id,
			});
			setShowModal(false);
			fetchUsers();
			setFormData({
				full_name: "",
				email: "",
				password: "",
				role: "student",
				student_id: "",
			});
			addToast("تم إنشاء الحساب بنجاح", "success");
		} catch (err) {
			addToast(err.response?.data?.message || "خطأ في العملية", "error");
		}
	};

	const roleLabel = { admin: "مسؤول", professor: "دكتور", student: "طالب" };
	const roleStyle = {
		admin: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
		professor:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
		student: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
	};

	const navItems = [
		{ key: "overview", label: "إدارة المستخدمين", icon: Users },
		{ key: "enrollment", label: "ربط الطلاب بالمواد", icon: UserPlus },
	];

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
						onClick={toggle}
						className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
					>
						{dark ? <Sun size={18} /> : <Moon size={18} />}
						{dark ? "الوضع النهاري" : "الوضع الليلي"}
					</button>
					<button
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
										onClick={() => setShowModal(true)}
										className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
									>
										<Plus size={18} /> إضافة مستخدم
									</button>
								</div>
							</div>

							{/* Stats */}
							<div className="grid grid-cols-3 gap-4 mb-8">
								{[
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
								].map((s, i) => (
									<StatCard key={i} {...s} />
								))}
							</div>

							{/* Table */}
							<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
								{loading ? (
									<div className="p-8 space-y-4">
										{[1, 2, 3, 4].map((i) => (
											<Skeleton key={i} className="h-14" />
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
			{showModal && (
				<div
					className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
					dir="rtl"
				>
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden animate-in zoom-in-95 duration-200">
						<div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-3xl"></div>
						<div className="flex justify-between items-center mb-7">
							<h3 className="text-xl font-black text-slate-900 dark:text-white">
								إضافة مستخدم جديد
							</h3>
							<button
								onClick={() => setShowModal(false)}
								className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
							>
								<X size={18} />
							</button>
						</div>
						<form onSubmit={handleCreateUser} className="space-y-4">
							{[
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
							].map(({ label, field, type, placeholder }) => (
								<div key={field} className="space-y-1.5">
									<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
										{label}
									</label>
									<input
										type={type}
										placeholder={placeholder}
										className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 dark:ring-blue-600 transition-all font-bold text-sm text-slate-800 dark:text-slate-200"
										value={formData[field]}
										onChange={(e) =>
											setFormData({ ...formData, [field]: e.target.value })
										}
										required
									/>
								</div>
							))}
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
										الصلاحية
									</label>
									<select
										className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-black text-blue-700 dark:text-blue-400 text-sm"
										value={formData.role}
										onChange={(e) =>
											setFormData({ ...formData, role: e.target.value })
										}
									>
										<option value="student">طالب</option>
										<option value="professor">دكتور</option>
										<option value="admin">مسؤول</option>
									</select>
								</div>
								{formData.role === "student" && (
									<div className="space-y-1.5 animate-in zoom-in duration-200">
										<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
											الرقم الجامعي
										</label>
										<input
											type="text"
											placeholder="ST-000"
											className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-bold text-sm text-slate-800 dark:text-slate-200"
											value={formData.student_id}
											onChange={(e) =>
												setFormData({ ...formData, student_id: e.target.value })
											}
											required
										/>
									</div>
								)}
							</div>
							<div className="flex gap-3 pt-2">
								<button
									type="submit"
									className="flex-[2] bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 transition-all active:scale-95"
								>
									إنشاء الحساب
								</button>
								<button
									type="button"
									onClick={() => setShowModal(false)}
									className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-4 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
								>
									إلغاء
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
};
// ==============================
// MAIN APP
// ==============================
const App = () => (
	<ThemeProvider>
		<ToastProvider>
			<AuthProvider>
				<BrowserRouter>
					<Routes>
						<Route path="/login" element={<LoginPage />} />
						<Route
							path="/admin"
							element={
								<ProtectedRoute allowedRoles={["admin"]}>
									<AdminDashboard />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/professor"
							element={
								<ProtectedRoute allowedRoles={["professor"]}>
									<ProfessorDashboard />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/student"
							element={
								<ProtectedRoute allowedRoles={["student"]}>
									<StudentDashboard />
								</ProtectedRoute>
							}
						/>
						<Route path="/" element={<Navigate to="/login" replace />} />
					</Routes>
				</BrowserRouter>
			</AuthProvider>
		</ToastProvider>
	</ThemeProvider>
);

export default App;
