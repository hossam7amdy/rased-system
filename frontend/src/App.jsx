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
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import { Skeleton } from "./components/ui/Skeleton";
import { StatCard } from "./components/ui/StatCard";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { AdminDashboard } from "./features/admin/AdminDashboard";
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
