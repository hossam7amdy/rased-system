import { AlertCircle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}
interface State {
	hasError: boolean;
}

// Zero-dependency class boundary: a render-time crash degrades to a recoverable
// message instead of a blank white screen.
export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("[ErrorBoundary]", error, info);
	}

	render() {
		if (!this.state.hasError) return this.props.children;
		return (
			<div
				className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center"
				dir="rtl"
			>
				<div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
					<AlertCircle className="text-red-600 dark:text-red-400" size={32} />
				</div>
				<h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">
					حدث خطأ غير متوقع
				</h1>
				<p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
					نعتذر، حدث خطأ ما. حاول إعادة تحميل الصفحة.
				</p>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
				>
					إعادة التحميل
				</button>
			</div>
		);
	}
}
