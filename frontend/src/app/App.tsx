import { GraduationCap } from "lucide-react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { ErrorBoundary } from "./ErrorBoundary";
import { ThemeProvider } from "./ThemeContext";

// Role dashboards are code-split: students never download admin/professor
// bundles and vice-versa.
const AdminDashboard = lazy(() =>
	import("../features/admin/AdminDashboard").then((m) => ({
		default: m.AdminDashboard,
	})),
);
const ProfessorDashboard = lazy(() =>
	import("../features/professor/ProfessorDashboard").then((m) => ({
		default: m.ProfessorDashboard,
	})),
);
const StudentDashboard = lazy(() =>
	import("../features/student/StudentDashboard").then((m) => ({
		default: m.StudentDashboard,
	})),
);

const PageLoader = () => (
	<div
		className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950"
		dir="rtl"
	>
		<div className="relative">
			<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-300/50 mb-6 mx-auto">
				<GraduationCap className="text-white" size={36} />
			</div>
			<div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
		</div>
		<p className="text-slate-400 font-bold text-sm mt-2">جاري التحميل...</p>
	</div>
);

export const App = () => (
	<ThemeProvider>
		<ToastProvider>
			<AuthProvider>
				<BrowserRouter>
					<ErrorBoundary>
						<Suspense fallback={<PageLoader />}>
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
						</Suspense>
					</ErrorBoundary>
				</BrowserRouter>
			</AuthProvider>
		</ToastProvider>
	</ThemeProvider>
);

export default App;
