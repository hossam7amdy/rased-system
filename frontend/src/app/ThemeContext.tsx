import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

interface ThemeValue {
	dark: boolean;
	toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>({
	dark: false,
	toggle: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [dark, setDark] = useState(
		() => localStorage.getItem("theme") === "dark",
	);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		localStorage.setItem("theme", dark ? "dark" : "light");
	}, [dark]);

	return (
		<ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = (): ThemeValue => useContext(ThemeContext);
