import { CheckCircle, Users, Zap } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { attendanceApi } from "../../lib/api";
import type { Course } from "../../lib/types";

interface AttendedStudent {
	studentName: string;
	studentUniversityId: string;
	scannedAt: string;
	attendanceStats: { percentage?: number };
}

interface DynamicQRDisplayProps {
	course: Course;
	sessionId: number | null;
}

export const DynamicQRDisplay = ({
	course,
	sessionId,
}: DynamicQRDisplayProps) => {
	const [qrValue, setQrValue] = useState("");
	const [timer, setTimer] = useState(8);
	const [attendedStudents, setAttendedStudents] = useState<AttendedStudent[]>(
		[],
	);
	const [isConnected, setIsConnected] = useState(false);

	// Poll QR token every 3s; server auto-rotates every 8s
	useEffect(() => {
		let cancelled = false;
		const fetchQR = async () => {
			try {
				const { token, remainingSeconds } = await attendanceApi.currentQr(
					course.id,
				);
				if (cancelled) return;
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
				const { records } = await attendanceApi.session(sessionId);
				if (cancelled) return;
				setAttendedStudents(
					(records ?? []).map((r) => ({
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
			setTimer((prev) => (prev > 0 ? prev - 1 : 0));
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
									key={pos}
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
						attendedStudents.map((s) => (
							<div
								key={`${s.studentUniversityId}-${s.scannedAt}`}
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
									{s.attendanceStats?.percentage != null && (
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
