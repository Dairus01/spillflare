"use client";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
const navigation = [["Explore Nigeria", "/explore"], ["Oil spills", "/oil-spills"], ["Gas flares", "/gas-flares"], ["Places", "/places"], ["Data & methods", "/data-and-methods"]] as const;
export function SiteHeader() {
  const pathname = usePathname(); const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-inner">
    <Link href="/" className="brand" aria-label="SpillFlare home"><Image src="/brand/spillflare-mark.svg" alt="" width={34} height={34} className="brand-mark" priority /><span><strong>SpillFlare</strong><small>Oil spills · Gas flares</small></span></Link>
    <nav className={open ? "global-nav is-open" : "global-nav"} aria-label="Primary navigation">{navigation.map(([label, href]) => <Link key={href} href={href} className={pathname === href || (href !== "/explore" && pathname.startsWith(`${href}/`)) ? "active" : ""} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/about" onClick={() => setOpen(false)}>About</Link></nav>
    <div className="header-actions"><Link href="/search" className="header-link"><Search size={16}/>Search</Link><Link href="/data-and-methods" className="header-link latest-link">Latest data</Link><Link href="/help" className="header-link help-link">Help</Link><ThemeToggle /><button className="icon-button mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button></div>
  </div></header>;
}
