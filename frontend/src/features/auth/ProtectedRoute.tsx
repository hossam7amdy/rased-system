import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "../../lib/types";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
	children: ReactNode;
	allowedRoles?: Role[];
}

export const ProtectedRoute = ({
	children,
	allowedRoles,
}: ProtectedRouteProps) => {
	const { user, loading } = useAuth();
	if (loading)
		return (
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
				<p className="text-slate-400 font-bold text-sm mt-2">
					جاري التحقق من الهوية...
				</p>
			</div>
		);
	if (!user) return <Navigate to="/login" replace />;
	if (allowedRoles && !allowedRoles.includes(user.role))
		return <Navigate to="/" replace />;
	return children;
};
