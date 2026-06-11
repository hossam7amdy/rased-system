import {
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Loader,
  Moon,
  Sun,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../app/ThemeContext.tsx";
import { useAuth } from "./AuthContext.tsx";

const stats = [
  { label: "حماية", value: "100%" },
  { label: "سرعة المسح", value: "2.4s" },
  { label: "دقة التحقق", value: "99.9%" },
];

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { dark, toggle } = useTheme();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      navigate(`/${user.role}`);
    } catch {
      setError("خطأ في البريد أو كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300"
      dir="rtl"
    >
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggle}
        className="fixed top-4 left-4 w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm hover:shadow-md transition-all"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-300/50 dark:shadow-slate-900/80 overflow-hidden border border-slate-200/60 dark:border-slate-700/60 min-h-[620px]">
        {/* Left panel — branding */}
        <div className="hidden md:flex bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-12 flex-col justify-between relative overflow-hidden text-right">
          {/* Background blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-400/20 rounded-full -ml-16 -mb-16 blur-3xl pointer-events-none"></div>

          {/* Top */}
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
              <GraduationCap size={30} className="text-white" />
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-3">
              نظام الحضور
              <br />
              الذكي
            </h2>
            <p className="text-sky-200/80 text-sm font-medium leading-relaxed max-w-xs">
              كلية التربية النوعية — جامعة المنصورة
              <br />
              نظام متطور لإدارة الحضور بتقنية QR الديناميكي.
            </p>
          </div>

          {/* Stats */}
          <div className="relative z-10">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
                >
                  <p className="text-2xl font-black text-white leading-none mb-1">
                    {s.value}
                  </p>
                  <p className="text-[10px] text-sky-200/70 font-bold uppercase tracking-wide">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-sky-300/50 font-bold text-center">
              فريق تكنولوجيا المعلومات © 2026
            </p>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <GraduationCap className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-none">
                كلية التربية النوعية
              </p>
              <p className="text-[10px] text-blue-700 font-bold">
                جامعة المنصورة
              </p>
            </div>
          </div>

          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
            تسجيل الدخول
          </h3>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mb-8">
            أدخل بياناتك للوصول إلى النظام
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-200 dark:border-red-800/50 flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle size={18} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest"
              >
                البريد الجامعي
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="name@university.edu"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 ring-blue-400/40 dark:ring-blue-600/40 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-800 dark:text-slate-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest"
              >
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 ring-blue-400/40 dark:ring-blue-600/40 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-800 dark:text-slate-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-900 hover:to-blue-700 text-white p-4 rounded-2xl font-black text-base shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  جاري التحقق...
                </>
              ) : (
                <>
                  دخول إلى النظام
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">
            كلية التربية النوعية · جامعة المنصورة · 2026
          </p>
        </div>
      </div>
    </div>
  );
};
