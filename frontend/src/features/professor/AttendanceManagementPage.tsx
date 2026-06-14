import {
  BarChart2,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Loader,
  Search,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "../../components/ui/Skeleton.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { analyticsApi, attendanceApi } from "../../lib/api.ts";
import { ApiError } from "../../lib/response.js";
import type {
  AttendanceRecord,
  Course,
  CourseStatistics,
  SessionSummary,
} from "../../lib/types.ts";

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export const AttendanceManagementPage = ({
  courses,
}: {
  courses: Course[];
}) => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(
    null,
  );
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStatistics | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const addToast = useToast();

  const fetchSessions = async (courseId: string) => {
    setLoadingSessions(true);
    setSessions([]);
    setSelectedSession(null);
    setSessionRecords([]);
    setCourseStats(null);
    try {
      const data = await analyticsApi.course(courseId);
      setCourseStats(data.statistics);
      // Sessions arrive in DESC order; reverse for chronological display so
      // the latest session appears last.
      const trend = data.attendance_trend || [];
      setSessions([...trend].reverse());
    } catch (err) {
      addToast(errMsg(err, "فشل في تحميل بيانات المادة"), "error");
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchSessionRecords = async (sessionId: string) => {
    setLoadingRecords(true);
    setSessionRecords([]);
    try {
      const { records } = await attendanceApi.session(sessionId);
      setSessionRecords(records || []);
    } catch (err) {
      addToast(errMsg(err, "فشل في تحميل سجلات الجلسة"), "error");
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleExport = async (type: "course" | "session") => {
    if (!selectedCourse) return;
    setLoadingExport(true);
    try {
      const blob = await analyticsApi.export({
        courseId: selectedCourse.id,
        ...(type === "session" && selectedSession
          ? { sessionId: selectedSession.id }
          : {}),
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${selectedCourse.course_code}_attendance.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast("تم تصدير الملف بنجاح", "success");
    } catch {
      addToast("حدث خطأ أثناء التصدير", "error");
    } finally {
      setLoadingExport(false);
    }
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    fetchSessions(course.id);
  };

  const handleSelectSession = (session: SessionSummary) => {
    setSelectedSession(session);
    if (session?.id != null) {
      fetchSessionRecords(session.id);
    } else {
      console.warn("[handleSelectSession] Session object has no id:", session);
    }
  };

  const filteredRecords = sessionRecords.filter((r) => {
    const matchSearch =
      !searchQuery ||
      r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.university_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Selector */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              اختر المادة
            </h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {courses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">
                لا توجد مواد
              </div>
            ) : (
              courses.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => handleSelectCourse(c)}
                  className={`w-full text-right p-4 flex items-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedCourse?.id === c.id ? "bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-700" : ""}`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedCourse?.id === c.id ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}
                  >
                    <BookOpen size={16} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-black truncate ${selectedCourse?.id === c.id ? "text-blue-800 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"}`}
                    >
                      {c.course_name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {c.course_code}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Stats + Sessions */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedCourse ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                <BarChart2
                  size={28}
                  className="text-slate-300 dark:text-slate-600"
                />
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-bold">
                اختر مادة لعرض سجل الحضور
              </p>
            </div>
          ) : loadingSessions ? (
            <div className="space-y-3">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {courseStats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "إجمالي المحاضرات",
                      value: courseStats.total_sessions || 0,
                      color: "text-blue-700 dark:text-blue-400",
                      bg: "bg-blue-50 dark:bg-blue-900/20",
                    },
                    {
                      label: "إجمالي الحضور",
                      value: courseStats.total_attendance || 0,
                      color: "text-emerald-600 dark:text-emerald-400",
                      bg: "bg-emerald-50 dark:bg-emerald-900/20",
                    },
                    {
                      label: "معدل الحضور",
                      value: `${courseStats.average_attendance || 0}%`,
                      color: "text-blue-700 dark:text-blue-400",
                      bg: "bg-blue-50 dark:bg-blue-900/20",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`${s.bg} rounded-2xl p-4 text-center`}
                    >
                      <p className={`text-2xl font-black ${s.color}`}>
                        {s.value}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">
                    المحاضرات
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport("course")}
                      disabled={loadingExport}
                      className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loadingExport ? (
                        <Loader size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      تصدير Excel
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-48 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                      لا توجد محاضرات مسجلة
                    </div>
                  ) : (
                    sessions.map((session, i) => (
                      <button
                        type="button"
                        key={session.id}
                        onClick={() => handleSelectSession(session)}
                        className={`w-full text-right p-4 flex items-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedSession?.id === session.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${selectedSession?.id === session.id ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
                            {session.session_name || `محاضرة ${i + 1}`}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                            {session.session_date
                              ? new Date(
                                  session.session_date,
                                ).toLocaleDateString("ar-EG")
                              : ""}
                            {session.attendance_count !== undefined &&
                              ` · ${session.attendance_count} حاضر`}
                          </p>
                        </div>
                        <ChevronRight
                          size={14}
                          className={`text-slate-300 dark:text-slate-600 flex-shrink-0 ${selectedSession?.id === session.id ? "text-blue-700" : ""}`}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Session Records */}
      {selectedSession && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">
                  {selectedSession.session_name || "تفاصيل المحاضرة"}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  {selectedSession.session_date
                    ? new Date(selectedSession.session_date).toLocaleDateString(
                        "ar-EG",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="بحث بالاسم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-blue-300 dark:ring-blue-700 w-40 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("session")}
                  disabled={loadingExport}
                  className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Download size={12} /> تصدير
                </button>
              </div>
            </div>
          </div>

          {loadingRecords ? (
            <div className="p-8 space-y-3">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-16 text-center">
              <UserX
                size={36}
                className="text-slate-200 dark:text-slate-700 mx-auto mb-3"
              />
              <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">
                لا توجد سجلات حضور لهذه الجلسة
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                {[
                  {
                    label: "إجمالي الحاضرين",
                    value: sessionRecords.length,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50/50 dark:bg-emerald-900/10",
                  },
                  {
                    label: "مسح QR",
                    value: sessionRecords.filter((r) => !r.is_manual_override)
                      .length,
                    color: "text-blue-700 dark:text-blue-400",
                    bg: "bg-blue-50/50 dark:bg-blue-900/10",
                  },
                  {
                    label: "تسجيل يدوي",
                    value: sessionRecords.filter((r) => r.is_manual_override)
                      .length,
                    color: "text-amber-600 dark:text-amber-400",
                    bg: "bg-amber-50/50 dark:bg-amber-900/10",
                  },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} p-4 text-center`}>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      {[
                        "#",
                        "الطالب",
                        "الرقم الجامعي",
                        "وقت التسجيل",
                        "الطريقة",
                        "الحالة",
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
                    {filteredRecords.map((record, i) => (
                      <tr
                        key={record.id}
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group"
                      >
                        <td className="p-4 text-slate-300 dark:text-slate-600 font-black text-xs">
                          {i + 1}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-700 group-hover:text-white text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center font-black transition-all text-xs">
                              {record.full_name?.charAt(0) || "؟"}
                            </div>
                            <span className="font-black text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">
                              {record.full_name || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400 dark:text-slate-500">
                          {record.university_id || "—"}
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                            <Clock
                              size={12}
                              className="text-slate-300 dark:text-slate-600"
                            />
                            {record.scanned_at
                              ? new Date(record.scanned_at).toLocaleString(
                                  "ar-EG",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${record.is_manual_override ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}
                          >
                            {record.is_manual_override ? "يدوي" : "QR"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs whitespace-nowrap">
                            <CheckCircle size={14} />
                            حاضر
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
