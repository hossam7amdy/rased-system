import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Skeleton } from "../../components/ui/Skeleton";
import { coursesApi } from "../../lib/api";
import type { Course } from "../../lib/types";
import { useAuth } from "../auth/AuthContext";
import { StudentScanner } from "./StudentScanner";

export const StudentDashboard = () => {
	const [myCourses, setMyCourses] = useState<Course[]>([]);
	const [selectedCourseId, setSelectedCourseId] = useState("");
	const [loading, setLoading] = useState(true);
	const { user } = useAuth();

	useEffect(() => {
		const fetchMyCourses = async () => {
			try {
				const { courses } = await coursesApi.myCourses();
				const list = courses || [];
				setMyCourses(list);
				if (list.length > 0) setSelectedCourseId(String(list[0].id));
			} catch (err) {
				console.error("خطأ أثناء جلب المواد:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchMyCourses();
	}, []);

	return (
		<DashboardLayout
			title="تسجيل الحضور"
			subtitle={`أهلاً ${user?.full_name?.split(" ")[0]} 👋`}
		>
			<div className="max-w-lg mx-auto space-y-5 animate-in slide-in-from-bottom-4 duration-500">
				{/* Course selector */}
				<div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
					<label
						htmlFor="course-select"
						className="block text-xs font-black text-blue-700 dark:text-blue-400 mb-3 uppercase tracking-widest"
					>
						المادة الدراسية
					</label>
					{loading ? (
						<Skeleton className="h-12" />
					) : (
						<select
							id="course-select"
							className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 ring-blue-300 dark:ring-blue-700 outline-none font-bold text-slate-700 dark:text-slate-300 transition-all text-sm"
							value={selectedCourseId}
							onChange={(e) => setSelectedCourseId(e.target.value)}
						>
							{myCourses.length > 0 ? (
								myCourses.map((course) => (
									<option key={course.id} value={course.id}>
										{course.course_name} ({course.course_code})
									</option>
								))
							) : (
								<option value="">لا توجد مواد مسجلة</option>
							)}
						</select>
					)}
				</div>

				{selectedCourseId ? (
					<div className="animate-in zoom-in-95 duration-400">
						<StudentScanner courseId={selectedCourseId} />
					</div>
				) : (
					!loading && (
						<div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
							<div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
								<BookOpen
									size={24}
									className="text-slate-300 dark:text-slate-600"
								/>
							</div>
							<p className="font-black text-slate-400 dark:text-slate-500 mb-1">
								لا توجد مواد متاحة
							</p>
							<p className="text-xs text-slate-300 dark:text-slate-600 font-medium">
								تأكد من تسجيلك في المواد الدراسية
							</p>
						</div>
					)
				)}
			</div>
		</DashboardLayout>
	);
};
