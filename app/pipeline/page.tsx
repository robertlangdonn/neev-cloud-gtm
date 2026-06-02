"use client";

import { useState } from "react";
import clustersData from "@/data/keywords/clusters.json";
import _STORED_BRIEFS from "@/data/briefs/index.json";
const STORED_BRIEFS = _STORED_BRIEFS as Record<string, string>;

type Cluster = typeof clustersData.clusters[number];

type NormKw = { keyword: string; volume?: number; cpc?: number; intent?: string };
function normalizeKws(kws: unknown[]): NormKw[] {
  return kws.map(k =>
    typeof k === "string" ? { keyword: k } : (k as NormKw)
  );
}

const INTENT_COLOR: Record<string, string> = {
  commercial: "var(--accent-amber)",
  transactional: "var(--accent-green)",
  informational: "var(--muted-foreground)",
};

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState<"keywords" | "brief" | "live-cluster">("keywords");
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [brief, setBrief] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefIsStored, setBriefIsStored] = useState(false);
  const [liveKeywords, setLiveKeywords] = useState<string>("");
  const [liveResult, setLiveResult] = useState<{ clusters?: Cluster[]; error?: string } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  async function generateBrief(cluster: Cluster, forceLive = false) {
    setSelectedCluster(cluster);
    setActiveTab("brief");
    setBrief("");
    setBriefLoading(true);
    setBriefIsStored(false);

    // Load pre-stored brief instantly if available and not forcing live
    if (!forceLive && STORED_BRIEFS[cluster.id]) {
      setBrief(STORED_BRIEFS[cluster.id]);
      setBriefIsStored(true);
      setBriefLoading(false);
      return;
    }

    const res = await fetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cluster_name: cluster.name,
        keywords: cluster.keywords,
        serp_gap: cluster.serp_gap,
        opportunity_score: cluster.opportunity_score,
        content_type: cluster.content_type,
      }),
    });

    if (!res.ok || !res.body) {
      setBrief("Error generating brief. Check API key.");
      setBriefLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) setBrief(prev => prev + decoder.decode(value));
    }
    setBriefLoading(false);
  }

  async function runLiveCluster() {
    if (!liveKeywords.trim()) return;
    setLiveLoading(true);
    setLiveResult(null);

    const kws = liveKeywords.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);

    // First get keyword data from DataForSEO
    let enriched = kws.map(k => ({ keyword: k }));
    try {
      const kwRes = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kws }),
      });
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        enriched = kwData.keywords ?? enriched;
      }
    } catch { /* use unenriched list */ }

    // Then cluster with Claude + embeddings
    const clRes = await fetch("/api/cluster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: enriched }),
    });

    if (!clRes.ok) {
      const err = await clRes.json();
      setLiveResult({ error: err.error ?? "Clustering failed" });
    } else {
      const data = await clRes.json();
      setLiveResult({ clusters: data.clusters ?? [] });
    }

    setLiveLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">

      {/* Header */}
      <section className="space-y-2">
        <p className="text-xs tracking-widest uppercase text-[var(--accent-green)]">Content Pipeline</p>
        <h1 className="text-2xl font-semibold tracking-tight">Keyword → Cluster → Brief</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Pre-loaded with NeevCloud&apos;s key topic clusters and keyword data. Select a cluster to generate a
          structured brief via Claude API, or paste your own keywords for live clustering.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {([
          { id: "keywords", label: "Topic Clusters" },
          { id: "brief", label: "Brief Generator" },
          { id: "live-cluster", label: "Live Cluster" },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? "text-[var(--foreground)] border-b-2 border-[var(--accent-green)] -mb-px"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Keywords tab */}
      {activeTab === "keywords" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted-foreground)]">
              {clustersData.clusters.length} clusters · pre-fetched via DataForSEO · {new Date(clustersData.generated_at).toLocaleDateString()}
            </p>
            <div className="text-xs text-[var(--muted-foreground)]">
              <span className="text-[var(--accent-green)] font-medium">{clustersData.volume_model.total_per_week}/week</span> target
            </div>
          </div>

          <div className="space-y-3">
            {clustersData.clusters.map(cluster => (
              <ClusterCard key={cluster.id} cluster={cluster} onGenerateBrief={() => generateBrief(cluster)} />
            ))}
          </div>

          {/* Volume model */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5 space-y-3">
            <p className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">Volume Model</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-xl font-semibold text-[var(--accent-green)]">{clustersData.volume_model.tier1_editorial_per_week}/week</div>
                <div className="text-[var(--muted-foreground)] mt-1">Tier 1 Editorial</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-[var(--accent-amber)]">{clustersData.volume_model.tier2_programmatic_per_week}/week</div>
                <div className="text-[var(--muted-foreground)] mt-1">Tier 2 Programmatic</div>
              </div>
              <div>
                <div className="text-xl font-semibold">{clustersData.volume_model.tier3_longtail_per_week}/week</div>
                <div className="text-[var(--muted-foreground)] mt-1">Tier 3 Long-tail</div>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{clustersData.volume_model.rationale}</p>
          </div>
        </section>
      )}

      {/* Brief tab */}
      {activeTab === "brief" && (
        <section className="space-y-4">
          {!selectedCluster && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Select a cluster from the <button onClick={() => setActiveTab("keywords")} className="text-[var(--accent-green)] underline">Topic Clusters</button> tab to generate a brief.
            </p>
          )}

          {selectedCluster && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                    {briefIsStored ? "Pre-generated brief for" : "Generating brief for"}
                  </p>
                  <p className="font-semibold">{selectedCluster.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedCluster.keywords.length} keywords · opportunity {selectedCluster.opportunity_score}/100 · {selectedCluster.content_type}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {briefIsStored && (
                    <button
                      onClick={() => generateBrief(selectedCluster, true)}
                      className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded transition-colors"
                    >
                      Run live →
                    </button>
                  )}
                  <button
                    onClick={() => generateBrief(selectedCluster, briefIsStored)}
                    disabled={briefLoading}
                    className="px-3 py-1.5 text-xs bg-[var(--accent-green)] text-[#0e0e10] rounded font-medium disabled:opacity-50"
                  >
                    {briefLoading ? "Generating…" : briefIsStored ? "Regenerate" : "Regenerate"}
                  </button>
                </div>
              </div>

              {briefIsStored && (
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block shrink-0"></span>
                  Pre-generated · loads instantly. Hit <strong className="text-[var(--foreground)] mx-1">Run live →</strong> to call Claude API in real time.
                </div>
              )}

              {briefLoading && !brief && (
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="inline-block w-1.5 h-1.5 bg-[var(--accent-green)] rounded-full animate-pulse"></span>
                  Calling Claude claude-sonnet-4-6…
                </div>
              )}

              {brief && (
                <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5">
                  <pre className="text-xs text-[var(--foreground)] whitespace-pre-wrap leading-relaxed font-mono">
                    {brief}
                    {briefLoading && <span className="inline-block w-1.5 h-3 bg-[var(--accent-green)] animate-pulse ml-0.5 align-middle" />}
                  </pre>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Live cluster tab */}
      {activeTab === "live-cluster" && (
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              Paste any keywords (one per line or comma-separated). The engine will:
            </p>
            <ol className="text-xs text-[var(--muted-foreground)] space-y-1 ml-4 list-decimal">
              <li>Fetch real volume + CPC + intent from DataForSEO (India location)</li>
              <li>Compute semantic embeddings via OpenAI</li>
              <li>Cluster and score via Claude with NeevCloud business context</li>
            </ol>
          </div>

          <div className="space-y-2">
            <textarea
              value={liveKeywords}
              onChange={e => setLiveKeywords(e.target.value)}
              placeholder={`sovereign cloud India\nGPU compute India\nH100 rental India\nBFSI cloud compliance\ndata residency India`}
              className="w-full h-36 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:border-[var(--accent-green)] font-mono"
            />
            <button
              onClick={runLiveCluster}
              disabled={liveLoading || !liveKeywords.trim()}
              className="px-4 py-2 text-xs bg-[var(--accent-green)] text-[#0e0e10] rounded font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {liveLoading ? (
                <>
                  <span className="w-1.5 h-1.5 bg-[#0e0e10] rounded-full animate-pulse inline-block"></span>
                  Running pipeline…
                </>
              ) : (
                "Run live cluster →"
              )}
            </button>
          </div>

          {liveResult?.error && (
            <div className="bg-[var(--panel)] border border-[var(--accent-red)] rounded-lg p-4 text-xs text-[var(--accent-red)]">
              {liveResult.error}
            </div>
          )}

          {liveResult?.clusters && liveResult.clusters.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                {liveResult.clusters.length} clusters found · live run
              </p>
              {liveResult.clusters.map((c, i) => (
                <ClusterCard
                  key={i}
                  cluster={c as Cluster}
                  onGenerateBrief={() => generateBrief(c as Cluster)}
                  live
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ClusterCard({ cluster, onGenerateBrief, live = false }: {
  cluster: Cluster;
  onGenerateBrief: () => void;
  live?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const tierColor = cluster.tier === 1
    ? "var(--accent-green)"
    : cluster.tier === 2
    ? "var(--accent-amber)"
    : "var(--muted-foreground)";

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-[#1e1e22] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="shrink-0 text-center">
          <div className="text-2xl font-semibold" style={{ color: tierColor }}>
            {cluster.opportunity_score}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">score</div>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{cluster.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: tierColor, borderColor: tierColor + "44" }}>
              T{cluster.tier} · {cluster.content_type}
            </span>
            {live && <span className="text-xs px-1.5 py-0.5 rounded border border-[var(--accent-green)] text-[var(--accent-green)]">live</span>}
          </div>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{cluster.rationale}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            {normalizeKws(cluster.keywords as unknown[]).slice(0, 4).map(k => (
              <span key={k.keyword} className="text-xs px-1.5 py-0.5 bg-[var(--border)] rounded flex items-center gap-1">
                <span className="text-[var(--foreground)]">{k.keyword}</span>
                {k.volume && (
                  <span style={{ color: INTENT_COLOR[k.intent ?? ""] ?? "var(--muted-foreground)" }}>
                    {(k.volume / 1000).toFixed(1)}k
                  </span>
                )}
              </span>
            ))}
            {cluster.keywords.length > 4 && (
              <span className="text-xs text-[var(--muted-foreground)]">+{cluster.keywords.length - 4} more</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-xs text-[var(--muted-foreground)]">{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-4 space-y-4">
          {/* SERP gap */}
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">SERP Gap</p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">{cluster.serp_gap}</p>
          </div>

          {/* Keyword table */}
          {(() => {
            const kws = normalizeKws(cluster.keywords as unknown[]).filter(k => k.volume);
            if (!kws.length) return null;
            return (
              <div className="space-y-1">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Keywords</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--muted-foreground)]">
                      <th className="text-left pb-1 font-normal">keyword</th>
                      <th className="text-right pb-1 font-normal">volume</th>
                      <th className="text-right pb-1 font-normal">cpc</th>
                      <th className="text-right pb-1 font-normal">intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kws.map(k => (
                      <tr key={k.keyword} className="border-t border-[var(--border)]">
                        <td className="py-1.5">{k.keyword}</td>
                        <td className="py-1.5 text-right">{k.volume?.toLocaleString() ?? "—"}</td>
                        <td className="py-1.5 text-right">{k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 text-right" style={{ color: INTENT_COLOR[k.intent ?? ""] ?? "var(--muted-foreground)" }}>
                          {k.intent ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Recommended posts */}
          {"recommended_posts" in cluster && Array.isArray(cluster.recommended_posts) && (
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Recommended Posts</p>
              <ul className="space-y-1">
                {cluster.recommended_posts.map((p: string) => (
                  <li key={p} className="text-xs text-[var(--foreground)] flex gap-2">
                    <span className="text-[var(--border)] shrink-0">·</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={onGenerateBrief}
            className="px-3 py-1.5 text-xs bg-[var(--accent-green)] text-[#0e0e10] rounded font-medium hover:opacity-90 transition-opacity"
          >
            Generate brief for this cluster →
          </button>
        </div>
      )}
    </div>
  );
}
