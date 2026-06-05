import axios from "axios";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { authApi } from "../../lib/api";
import {
	bearer,
	clearToken,
	getToken,
	setToken,
} from "../../lib/auth-token.js";
import type { User } from "../../lib/types";

interface AuthValue {
	user: User | null;
	token: string | null;
	login: (email: string, password: string) => Promise<User>;
	logout: () => void;
	loading: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export const useAuth = (): AuthValue => {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
	return ctx;
};

// Transitional: components not yet migrated to lib/api's client still use the
// global axios default header. Keep setting it here until the Phase 2 finalize
// step removes the last global-axios call site.
const setLegacyHeader = (token: string | null) => {
	if (token) {
		axios.defaults.headers.common.Authorization = bearer(token) ?? "";
	} else {
		delete axios.defaults.headers.common.Authorization;
	}
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null);
	const [token, setTokenState] = useState<string | null>(getToken());
	const [loading, setLoading] = useState(true);

	const logout = useCallback(() => {
		setUser(null);
		setTokenState(null);
		clearToken();
		setLegacyHeader(null);
	}, []);

	const fetchProfile = useCallback(async () => {
		try {
			const { user: profile } = await authApi.profile();
			setUser(profile);
		} catch {
			logout();
		} finally {
			setLoading(false);
		}
	}, [logout]);

	useEffect(() => {
		if (token) {
			setLegacyHeader(token);
			fetchProfile();
		} else {
			setLoading(false);
		}
	}, [token, fetchProfile]);

	const login = async (email: string, password: string) => {
		const { accessToken, user: loggedIn } = await authApi.login(
			email,
			password,
		);
		setToken(accessToken);
		setLegacyHeader(accessToken);
		setTokenState(accessToken);
		setUser(loggedIn);
		return loggedIn;
	};

	return (
		<AuthContext.Provider value={{ user, token, login, logout, loading }}>
			{children}
		</AuthContext.Provider>
	);
};
