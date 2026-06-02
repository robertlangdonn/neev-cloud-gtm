"use client";

import { useState } from "react";

interface QAFlag {
  dimension: string;
  severity: "critical" | "warning" | "info";
  issue: string;
  suggestion: string;
}

interface QAResult {
  depth: number;
  eeat: number;
  originality: number;
  hallucination_risk: number;
  brand_safety: number;
  quality_avg: number;
  verdict: "PASS" | "REVIEW" | "FAIL";
  flags: QAFlag[];
  summary: string;
  scored_at: string;
  error?: string;
}

const SAMPLE_CONTENT = `# H100 GPU Cloud Pricing in India: A Complete Guide

India's GPU cloud market has grown rapidly in 2024-2025, with several providers now offering NVIDIA H100 instances.
NeevCloud offers H100 SXM5 at $1.69/hour (₹141/hour), approximately 50% cheaper than AWS p4d instances in comparable US regions.

## What You Get with an H100 Instance

The NVIDIA H100 SXM5 delivers 80GB HBM3 memory with 3.35 TB/s memory bandwidth. For LLM inference workloads,
you can expect approximately 120 tokens/second for a 70B parameter model in FP16.

Key specifications:
- 80GB HBM3 memory
- 3.35 TB/s memory bandwidth
- 700W TDP
- NVLink 4.0 for multi-GPU setups

## Why India-Sovereign GPU Compute Matters

For enterprises in BFSI and government sectors, data residency is non-negotiable. Using US-based GPU cloud
providers for model training on sensitive data may violate RBI guidelines and the DPDP Act 2023.

NeevCloud's infrastructure is MeitY-empanelled, ensuring your data never leaves Indian jurisdiction.

## Pricing Comparison

| Provider | Instance | Price/hour |
|----------|----------|-----------|
| NeevCloud | H100 SXM5 | $1.69 |
| AWS | p4d.24xlarge | $32.77 |
| Azure | Standard_ND96asr_v4 | $27.20 |

NeevCloud is significantly cheaper because of lower infrastructure costs in India.`;

const SCORE_COLOR = (n: number, inverted = false) => {
  if (inverted) {
    if (n <= 3) return "var(--accent-green)";
    if (n <= 6) return "var(--accent-amber)";
    return "var(--accent-red)";
  }
  if (n >= 7) return "var(--accent-green)";
  if (n >= 5) return "var(--accent-amber)";
  return "var(--accent-red)";
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--accent-red)",
  warning: "var(--accent-amber)",
  info: "var(--muted-foreground)",
};

export default function QAPage() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<QAResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runQA(sampleContent?: string) {
    const text = sampleContent ?? content;
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, title }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function useSample() {
    setContent(SAMPLE_CONTENT);
    setTitle("H100 GPU Cloud Pricing India: A Complete Guide");
  }

  const verdictColor = result?.verdict === "PASS"
    ? "var(--accent-green)"
    : result?.verdict === "REVIEW"
    ? "var(--accent-amber)"
    : "var(--accent-red)";

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">

      {/* Header */}
      <section className="space-y-2">
        <p className="text-xs tracking-widest uppercase text-[var(--accent-green)]">Quality Gate</p>
        <h1 className="text-2xl font-semibold tracking-tight">Pre-publish QA Scoring</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Every piece of content must pass this gate before it reaches the CMS. 5-dimension scoring via
          Claude API: depth, E-E-A-T, originality, hallucination risk, and brand safety.
          PASS requires quality avg ≥ 7, hallucination risk ≤ 4, brand safety risk ≤ 3.
        </p>
      </section>

      {/* Score dimensions explainer */}
      <section className="grid grid-cols-5 gap-2 text-xs">
        {[
          { label: "Depth", desc: "Technical density, evidence, word count adequacy" },
          { label: "E-E-A-T", desc: "Author entity, citations, experience markers" },
          { label: "Originality", desc: "First-party data, India context, SERP gap filled" },
          { label: "Hallucination", desc: "Unsourced claims, wrong numbers — lower is better" },
          { label: "Brand Safety", desc: "Compliance risk, competitor exposure — lower is better" },
        ].map(({ label, desc }) => (
          <div key={label} className="bg-[var(--panel)] border border-[var(--border)] rounded p-3 space-y-1">
            <p className="font-medium">{label}</p>
            <p className="text-[var(--muted-foreground)] leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* Input */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Content to score</p>
          <button
            onClick={useSample}
            className="text-xs text-[var(--accent-green)] hover:underline"
          >
            Use sample content →
          </button>
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent-green)] font-mono"
        />

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Paste draft content here (markdown or plain text)…"
          className="w-full h-56 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:border-[var(--accent-green)] font-mono leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => runQA()}
            disabled={loading || !content.trim()}
            className="px-4 py-2 text-xs bg-[var(--accent-green)] text-[#0e0e10] rounded font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-1.5 h-1.5 bg-[#0e0e10] rounded-full animate-pulse inline-block"></span>
                Scoring…
              </>
            ) : (
              "Run QA gate →"
            )}
          </button>
          {content && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {content.split(/\s+/).filter(Boolean).length} words
            </span>
          )}
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="space-y-4">

          {result.error ? (
            <div className="bg-[var(--panel)] border border-[var(--accent-red)] rounded-lg p-4 text-xs text-[var(--accent-red)]">
              {result.error}
            </div>
          ) : (
            <>
              {/* Verdict */}
              <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5 flex items-center gap-6"
                style={{ borderLeftWidth: 4, borderLeftColor: verdictColor }}>
                <div className="text-center shrink-0">
                  <div className="text-4xl font-semibold" style={{ color: verdictColor }}>
                    {result.verdict}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">verdict</div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold" style={{ color: verdictColor }}>
                      {result.quality_avg.toFixed(1)}
                    </span>
                    <span className="text-sm text-[var(--muted-foreground)]">/ 10 quality avg</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{result.summary}</p>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Depth", value: result.depth },
                  { label: "E-E-A-T", value: result.eeat },
                  { label: "Originality", value: result.originality },
                  { label: "Hallucination", value: result.hallucination_risk, inverted: true },
                  { label: "Brand Safety", value: result.brand_safety, inverted: true },
                ].map(({ label, value, inverted }) => (
                  <div key={label} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3 text-center">
                    <div className="text-2xl font-semibold" style={{ color: SCORE_COLOR(value, inverted) }}>
                      {value}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">{label}</div>
                    {inverted && <div className="text-xs text-[var(--muted-foreground)]">(lower = better)</div>}
                  </div>
                ))}
              </div>

              {/* Flags */}
              {result.flags && result.flags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                    {result.flags.length} issue{result.flags.length !== 1 ? "s" : ""} flagged
                  </p>
                  {result.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3 space-y-1"
                      style={{ borderLeftWidth: 3, borderLeftColor: SEVERITY_COLOR[flag.severity] }}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: SEVERITY_COLOR[flag.severity] }}>{flag.severity}</span>
                        <span className="text-[var(--muted-foreground)]">·</span>
                        <span className="text-[var(--muted-foreground)]">{flag.dimension}</span>
                      </div>
                      <p className="text-xs text-[var(--foreground)]">{flag.issue}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">→ {flag.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-[var(--muted-foreground)]">
                Scored at {new Date(result.scored_at).toUTCString()} · Claude claude-sonnet-4-6 with structured output
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
