import { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, Camera, CheckCircle, Shield, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { attendanceApi } from "../../lib/api.ts";
import { ApiError } from "../../lib/response.js";

interface StudentScannerProps {
  courseId: string | number;
}

type ScanStatus = { type: "" | "success" | "error"; msg: string };

export const StudentScanner = ({ courseId }: StudentScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<ScanStatus>({ type: "", msg: "" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const courseIdRef = useRef(courseId);

  useEffect(() => {
    courseIdRef.current = courseId;
  }, [courseId]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner Cleanup Warning:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  const startScanner = async () => {
    if (!courseIdRef.current) {
      setStatus({
        type: "error",
        msg: "يرجى اختيار المادة من القائمة قبل فتح الكاميرا.",
      });
      return;
    }
    setStatus({ type: "", msg: "" });
    setIsScanning(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            await stopScanner();
            try {
              await attendanceApi.scan(
                decodedText,
                Number(courseIdRef.current),
              );
              setStatus({ type: "success", msg: "تم تسجيل حضورك بنجاح! ✅" });
            } catch (err) {
              const errMsg =
                err instanceof ApiError
                  ? err.message
                  : "كود غير صالح أو منتهي، حاول مرة أخرى";
              setStatus({ type: "error", msg: errMsg });
            }
          },
          () => {},
        );
      } catch {
        setStatus({
          type: "error",
          msg: "تعذر الوصول للكاميرا. تأكد من إعطاء الصلاحيات للمتصفح.",
        });
        setIsScanning(false);
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      {status.msg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300 shadow-lg border ${
            status.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${status.type === "success" ? "bg-emerald-500" : "bg-red-500"} text-white`}
          >
            {status.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
          </div>
          <span className="font-black">{status.msg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-48 h-48 bg-blue-50 dark:bg-blue-900/10 rounded-full -translate-x-24 -translate-y-24 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full translate-x-16 translate-y-16 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-700 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50">
            <Camera size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            مسح كود QR
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed max-w-xs mx-auto">
            وجّه الكاميرا نحو شاشة الدكتور لتسجيل حضورك في المادة المختارة
          </p>

          {!isScanning ? (
            <button
              type="button"
              onClick={startScanner}
              className="w-full bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-900 hover:to-blue-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Camera size={22} />
              بدء المسح الآن
            </button>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="relative mb-6">
                <div
                  id="reader"
                  className="overflow-hidden rounded-2xl border-4 border-blue-100 dark:border-blue-900/50 bg-black shadow-2xl aspect-square"
                ></div>
                {/* Scanner frame corners */}
                <div className="absolute top-3 right-3 w-8 h-8 border-t-4 border-r-4 border-blue-600 rounded-tr-xl pointer-events-none"></div>
                <div className="absolute top-3 left-3 w-8 h-8 border-t-4 border-l-4 border-blue-600 rounded-tl-xl pointer-events-none"></div>
                <div className="absolute bottom-3 right-3 w-8 h-8 border-b-4 border-r-4 border-blue-600 rounded-br-xl pointer-events-none"></div>
                <div className="absolute bottom-3 left-3 w-8 h-8 border-b-4 border-l-4 border-blue-600 rounded-bl-xl pointer-events-none"></div>
                {/* Scan line animation */}
                <div className="absolute inset-x-4 top-4 h-0.5 bg-cyan-400/70 animate-bounce pointer-events-none"></div>
              </div>
              <button
                type="button"
                onClick={stopScanner}
                className="flex items-center gap-2 mx-auto text-red-500 dark:text-red-400 font-black hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                <X size={16} /> إيقاف الكاميرا
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="text-slate-300" size={22} />
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
            حماية البيانات
          </p>
          <p className="text-slate-300 text-xs font-medium leading-relaxed">
            يتم التحقق من هويتك وتسجيل الوقت الفعلي لضمان نزاهة عملية الحضور.
          </p>
        </div>
      </div>
    </div>
  );
};
