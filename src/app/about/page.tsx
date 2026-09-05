import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Map, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return <>
    <section className="hero"><div className="container hero-grid"><div><span className="eyebrow">About the product</span><h1>Environmental records should be <span>possible to understand.</span></h1><p>SpillFlare reorganises public oil spill and gas flare data into a faster, clearer, open web experience for citizens, journalists, researchers and decision-makers.</p><div className="hero-actions"><Link className="button" href="/explore">Explore records<ArrowRight size={16}/></Link></div></div><div className="hero-panel"><div className="pulse-row"><div><strong>Open first</strong><span>No account or payment gate</span></div></div><div className="pulse-row"><div><strong>Nigeria only</strong><span>Purpose-built geography and terminology</span></div></div><div className="pulse-row"><div><strong>Source honest</strong><span>Gaps and historical limits stay visible</span></div></div></div></div></section>
    <section className="section"><div className="container"><SectionHeading eyebrow="Product principles" title="Clear enough for the public. Rigorous enough for research."/><div className="card-grid"><div className="card"><div className="card-icon"><Eye size={21}/></div><h3>Explain before assuming</h3><p>Technical codes, missing fields and date coverage are translated into plain language without inventing conclusions.</p></div><div className="card"><div className="card-icon"><Map size={21}/></div><h3>Respect geography</h3><p>States, LGAs, blocks and clusters can overlap, but they are never treated as the same object.</p></div><div className="card"><div className="card-icon"><ShieldCheck size={21}/></div><h3>Trace every record</h3><p>Source attribution and evidence links stay close to the data the visitor is using.</p></div></div></div></section>
  </>;
}
