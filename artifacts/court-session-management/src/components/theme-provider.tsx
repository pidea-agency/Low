import { createContext, useContext, useEffect } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: 'light';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Permanently enforce light mode across the entire application
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    if (document.body) {
      document.body.classList.remove('dark');
    }
    try {
      localStorage.removeItem('theme');
      localStorage.removeItem('theme_mode');
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

