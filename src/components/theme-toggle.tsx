"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme(); const isDark=resolvedTheme === "dark";
  return <button className="icon-button" aria-label="Toggle dark mode" onClick={() => setTheme(isDark ? "light" : "dark")}><span className="theme-light-icon"><Moon size={18}/></span><span className="theme-dark-icon"><Sun size={18}/></span></button>;
}
