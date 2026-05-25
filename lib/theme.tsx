'use client';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface ThemeContextType { darkMode: boolean; toggleDarkMode: () => void; }
const ThemeContext = createContext<ThemeContextType>({ darkMode: false, toggleDarkMode: () => {} });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('darkMode', JSON.stringify(next));
      try {
        // Persist preference to a cookie so the server can render the same theme
        document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    // Load saved preference after mount to avoid SSR/CSR mismatch
    let saved: string | null = null;
    try { saved = localStorage.getItem('darkMode'); } catch (e) { saved = null; }
    if (saved !== null) {
      setDarkMode(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}