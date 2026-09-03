"use client";
import { Download } from "lucide-react";
export function ExportLink({ href, label = "Export CSV" }: { href: string; label?: string }) { return <a className="button ghost" href={href} download><Download size={16}/>{label}</a>; }
