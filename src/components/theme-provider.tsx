"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useTheme } from "next-themes";
import { useEffect } from "react";
function ThemeQuerySync(){const{setTheme}=useTheme();useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("theme");if(requested==="light"||requested==="dark")setTheme(requested)},[setTheme]);return null}
export function ThemeProvider({ children }: { children: React.ReactNode }) { return <NextThemesProvider attribute="data-theme" defaultTheme="light" enableSystem><ThemeQuerySync/>{children}</NextThemesProvider>; }
