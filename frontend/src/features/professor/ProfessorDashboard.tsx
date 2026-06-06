import {
	BarChart2,
	BookOpen,
	Calendar,
	Plus,
	QrCode,
	Trash2,
	X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { attendanceApi, coursesApi } from "../../lib/api";
import { localISODate } from "../../lib/date";
import { ApiError } from "../../lib/response.js";
import type { Course } from "../../lib/types";
import { AttendanceManagementPage } from "./AttendanceManagementPage";
import { DynamicQRDisplay } from "./DynamicQRDisplay";

type Tab = "courses" | "attendance";

const blankCourse = {
	courseCode: "",
	courseName: "",
	semester: "Fall",
	academicYear: "2025/2026",
};

export const ProfessorDashboard = () => {
	const [courses, setCourses] = useState<Course[]>([]);
	const [activeSession, setActiveSession] = useState<Course | null>(null);
	const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [activeTab, setActiveTab] = useState<Tab>("courses");
	const [newCourse, setNewCourse] = useState({ ...blankCourse });
	const [loading, setLoading] = useState(true);
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
	const addToast = useToast();

	const fetchCourses = useCallback(async () => {
		setLoading(true);
		try {
			const { courses: fetched } = await coursesApi.list();
			if (!Array.isArray(fetched)) {
				addToast("فشل في تحميل المواد", "error");
				return;
			}
			setCourses(fetched);
		} catch (err) {
			addToast(
				err instanceof ApiError ? err.message : "فشل في تحميل المواد",
				"error",
			);
		} finally {
			setLoading(false);
		}
	}, [addToast]);

	useEffect(() => {
		fetchCourses();
	}, [fetchCourses]);

	const handleDeleteCourse = async (courseId: number) => {
		try {
			await coursesApi.remove(courseId);
			setCourses((prev) => prev.filter((c) => c.id !== courseId));
			addToast("تم حذف المادة بنجاح", "success");
		} catch {
			addToast("فشل في حذف المادة", "error");
		} finally {
			setConfirmDelete(null);
		}
	};

	const handleAddCourse = async (e: FormEvent) => {
		e.preventDefault();
		try {
			await coursesApi.create(newCourse);
			setShowAddModal(false);
			fetchCourses();
			setNewCourse({ ...blankCourse });
			addToast("تمت إضافة المادة بنجاح", "success");
		} catch {
			addToast("حدث خطأ أثناء الإضافة", "error");
		}
	};

	const handleStartSession = async (course: Course) => {
		try {
			const { session } = await attendanceApi.startSession({
				courseId: course.id,
				sessionName: `محاضرة ${new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`,
				sessionDate: localISODate(),
			});
			setActiveSessionId(session?.id ?? null);
			setActiveSession(course);
		} catch {
			addToast("فشل في بدء الجلسة على الخادم", "error");
		}
	};

	const handleEndSession = async () => {
		try {
			if (activeSessionId) {
				await attendanceApi.endSession(activeSessionId);
			}
		} catch {}
		setActiveSession(null);
		setActiveSessionId(null);
	};

	return (
		<DashboardLayout
			title={
				activeSession
					? `جلسة نشطة: ${activeSession.course_name}`
					: "لوحة المحاضر"
			}
			subtitle="كلية التربية النوعية — جامعة المنصورة"
		>
			{activeSession ? (
				<div className="animate-in fade-in zoom-in-95 duration-500">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-4 py-2.5 rounded-xl">
								<div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
								<span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
									جلسة نشطة
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={handleEndSession}
							className="flex items-center gap-2 bg-white dark:bg-slate-900 text-red-500 border border-red-200 dark:border-red-800/50 px-5 py-2.5 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-black text-sm shadow-sm"
						>
							<X size={16} /> إنهاء الجلسة
						</button>
					</div>
					<DynamicQRDisplay
						course={activeSession}
						sessionId={activeSessionId}
					/>
				</div>
			) : (
				<>
					{/* Tabs */}
					<div className="flex items-center gap-1 mb-8 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-700/60 w-fit">
						{(
							[
								{ key: "courses", label: "المواد الدراسية", icon: BookOpen },
								{ key: "attendance", label: "سجل الحضور", icon: BarChart2 },
							] as const
						).map((tab) => (
							<button
								type="button"
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
									activeTab === tab.key
										? "bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50"
										: "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
								}`}
							>
								<tab.icon size={16} />
								{tab.label}
							</button>
						))}
					</div>

					{/* Courses Tab */}
					{activeTab === "courses" && (
						<div className="animate-in fade-in duration-300">
							<div className="flex justify-between items-center mb-6">
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-black text-slate-900 dark:text-white">
										المواد الدراسية
									</h2>
									<span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black px-3 py-1 rounded-full">
										{courses.length}
									</span>
								</div>
								<button
									type="button"
									onClick={() => setShowAddModal(true)}
									className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
								>
									<Plus size={16} /> مادة جديدة
								</button>
							</div>

							{loading ? (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
									{["a", "b", "c"].map((k) => (
										<Skeleton key={k} className="h-64" />
									))}
								</div>
							) : courses.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-24 text-center">
									<div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-5">
										<BookOpen
											size={32}
											className="text-slate-300 dark:text-slate-600"
										/>
									</div>
									<h3 className="text-lg font-black text-slate-400 dark:text-slate-500 mb-2">
										لا توجد مواد بعد
									</h3>
									<p className="text-sm text-slate-300 dark:text-slate-600 font-medium">
										أضف أول مادة دراسية للبدء
									</p>
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
									{courses.map((c) => (
										<div
											key={c.id}
											className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-xl dark:hover:shadow-slate-800/50 transition-all duration-300 overflow-hidden"
										>
											<div className="h-1.5 bg-gradient-to-r from-blue-800 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
											<div className="p-6">
												<div className="flex justify-between items-start mb-5">
													<div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-all">
														<BookOpen size={22} />
													</div>
													<div className="text-right">
														<p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase">
															المسجلون
														</p>
														<p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
															{c.student_count || 0}
														</p>
													</div>
												</div>
												<h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors leading-tight">
													{c.course_name}
												</h3>
												<p className="text-blue-700 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-4">
													{c.course_code}
												</p>
												<div className="flex flex-wrap gap-2 mb-5">
													<span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400 flex items-center gap-1">
														<Calendar size={9} /> {c.semester}
													</span>
													<span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400">
														{c.academic_year}
													</span>
													{c.session_count != null && c.session_count > 0 && (
														<span className="text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full text-blue-700 dark:text-blue-400">
															{c.session_count} محاضرة
														</span>
													)}
												</div>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => handleStartSession(c)}
														className="flex-1 bg-slate-900 dark:bg-slate-700 hover:bg-blue-700 dark:hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
													>
														<QrCode size={16} /> بدء التحضير
													</button>
													<button
														type="button"
														onClick={() => setActiveTab("attendance")}
														className="px-3.5 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl transition-colors"
														title="سجل الحضور"
													>
														<BarChart2 size={16} />
													</button>
													<button
														type="button"
														onClick={() => setConfirmDelete(c.id)}
														className="px-3.5 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-400 dark:text-red-400 rounded-xl transition-colors"
														title="حذف المادة"
													>
														<Trash2 size={16} />
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{activeTab === "attendance" && (
						<div className="animate-in fade-in duration-300">
							<AttendanceManagementPage courses={courses} />
						</div>
					)}
				</>
			)}

			{/* Add Course Modal */}
			<Modal
				open={showAddModal}
				onClose={() => setShowAddModal(false)}
				title="إضافة مادة دراسية"
				maxWidth="max-w-lg"
			>
				<form onSubmit={handleAddCourse} className="space-y-5">
					<Field
						id="course-name"
						label="اسم المادة"
						type="text"
						placeholder="مثال: مقدمة في علوم الحاسب"
						onChange={(e) =>
							setNewCourse({ ...newCourse, courseName: e.target.value })
						}
						required
					/>
					<Field
						id="course-code"
						label="كود المادة"
						type="text"
						placeholder="CS101"
						className="font-mono"
						onChange={(e) =>
							setNewCourse({ ...newCourse, courseCode: e.target.value })
						}
						required
					/>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label
								htmlFor="course-semester"
								className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider"
							>
								الفصل الدراسي
							</label>
							<select
								id="course-semester"
								className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-blue-700 dark:text-blue-400 text-sm"
								onChange={(e) =>
									setNewCourse({ ...newCourse, semester: e.target.value })
								}
							>
								<option value="Fall">الخريف (Fall)</option>
								<option value="Spring">الربيع (Spring)</option>
								<option value="Summer">الصيف (Summer)</option>
							</select>
						</div>
						<Field
							id="course-year"
							label="السنة الأكاديمية"
							type="text"
							defaultValue="2025/2026"
							className="text-center"
							onChange={(e) =>
								setNewCourse({ ...newCourse, academicYear: e.target.value })
							}
							required
						/>
					</div>
					<div className="flex gap-3 pt-2">
						<Button type="submit" className="flex-[2] py-4">
							حفظ المادة
						</Button>
						<Button
							variant="secondary"
							onClick={() => setShowAddModal(false)}
							className="flex-1 py-4"
						>
							إلغاء
						</Button>
					</div>
				</form>
			</Modal>

			{/* Confirm Delete Modal */}
			<ConfirmModal
				isOpen={confirmDelete != null}
				title="حذف المادة الدراسية"
				message="هل أنت متأكد؟ سيتم حذف جميع الجلسات والسجلات المرتبطة بهذه المادة بشكل نهائي."
				onConfirm={() => {
					if (confirmDelete != null) handleDeleteCourse(confirmDelete);
				}}
				onCancel={() => setConfirmDelete(null)}
			/>
		</DashboardLayout>
	);
};
