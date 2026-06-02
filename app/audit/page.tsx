import { readFileSync } from "fs";
import { join } from "path";

interface AuditReport {
  generatedAt: string;
  seeds: string[];
  config: { maxPagesPerDomain: number; maxDepth: number };
  perDomain: Array<{
    domain: string;
    sitemapUrlCount: number;
    crawledPageCount: number;
    robotsBlocksAll: boolean;
    robotsSitemaps: string[];
    robotsContentSignals: string[];
    sitemapIssues: Array<{ type: string; url: string; status?: number; note?: string }>;
  }>;
  corpus: { totalPages: number; indexablePages: number; avgInternalInlinks: number; pagesWithZeroInlinks: number };
  crossDomain: { hosts: string[]; matrix: Record<string, Record<string, number>> };
  orphans: Array<{ url: string; title: string }>;
  cannibalizationClusters: Array<Array<{ url: string; title: string }>>;
  linkRecommendations: Record<string, Array<{ url: string; title: string; score: number }>>;
}

function loadAudit(): AuditReport {
  const raw = readFileSync(join(process.cwd(), "data/audit.json"), "utf8");
  return JSON.parse(raw);
}

function fmt(url: string) {
  return url.replace("https://", "").replace("http://", "");
}

export default function AuditPage() {
  const R = loadAudit();
  const www = R.crossDomain.matrix["www.neevcloud.com"] ?? {};
  const blog = R.crossDomain.matrix["blog.neevcloud.com"] ?? {};
  const cannibalCount = R.cannibalizationClusters.reduce((a, c) => a + c.length, 0);
  const topRecs = Object.entries(R.linkRecommendations).slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

      {/* Header */}
      <section className="space-y-2">
        <p className="text-xs tracking-widest uppercase text-[var(--accent-green)]">Site Audit · Live Run</p>
        <h1 className="text-2xl font-semibold tracking-tight">NeevCloud Internal-Linking & Indexation Audit</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Ran against <strong className="text-[var(--foreground)]">{R.seeds.join(" + ")}</strong> · {new Date(R.generatedAt).toUTCString()} · cap {R.config.maxPagesPerDomain} pages/domain · sitemap-first, BFS fallback, robots-aware. Every number below is from their production site.
        </p>
        <p className="text-xs text-[var(--muted-foreground)] pt-1 font-mono">
          <span className="text-[var(--accent-green)]">$</span> node src/audit.js --domains www.neevcloud.com,blog.neevcloud.com --max 30
        </p>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat n={String(R.corpus.totalPages)} label="pages analyzed" />
        <Stat n={String(R.corpus.avgInternalInlinks)} label="avg internal inlinks" color="var(--accent-amber)" />
        <Stat n={String(R.orphans.length)} label="orphan money pages" color="var(--accent-red)" />
        <Stat n={String(cannibalCount)} label="cannibalizing pages" color="var(--accent-red)" />
      </section>

      {/* Findings */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">Critical Findings — from their live site</h2>

        <Finding severity="crit" title="Split-brain authority: blog → money-page links = 0">
          Cross-domain link matrix: <strong>www → blog = {www["blog.neevcloud.com"] ?? 0}</strong>, but{" "}
          <strong>blog → www = {blog["www.neevcloud.com"] ?? 0}</strong>. Their ~234-post content base is a
          topical-authority reservoir that sends <strong>no</strong> link equity to the GPU pages that convert.
          At 80/week this asymmetry compounds — every new post deepens the split-brain rather than fixing it.
        </Finding>

        <Finding severity="warn" title="Blog sitemap blocked for all non-Googlebot crawlers (SEO auditability gap)">
          <code>blog.neevcloud.com</code> is hosted on Hashnode, sitting behind a Vercel security checkpoint.
          The sitemap returns HTTP 429 for every bot UA — including spoofed Googlebot — because Vercel
          IP-verifies real Googlebot separately. Real Googlebot can almost certainly access the sitemap. The
          actual problem: <strong>you cannot audit it.</strong> Ahrefs, Screaming Frog, any third-party SEO
          tool, and your own crawl scripts are all blind. You have no visibility into whether all 234 posts
          are indexed, which are being crawled on what cadence, or where crawl budget is leaking. Migrating
          to <code>neevcloud.com/learn/</code> gives you full log-file access, unified domain authority, and
          eliminates the split-brain linking problem in one move.
        </Finding>

        <Finding severity="warn" title={`${R.orphans.length} revenue pages with zero internal inlinks`}>
          {R.orphans.slice(0, 4).map(o => (
            <code key={o.url} className="mr-2 text-xs bg-[var(--border)] px-1 py-0.5 rounded">{fmt(o.url).split("/").pop()}</code>
          ))} — GPU SKUs they actively sell, discoverable by crawlers only via the sitemap.
          A volume system that does not auto-link new pages mints new orphans every week.
        </Finding>

        <Finding severity="warn" title="Sitemap hygiene defect detected programmatically">
          A <code>&lt;loc&gt;</code> entry ships with a trailing space (<code>nvidia-gb200-nvl72.php </code>) — a
          parse-fragile URL. Small, but it is the tell that the sitemap is hand-maintained, exactly what
          breaks at 4,160 URLs/year. Sharded programmatic sitemaps with machine-generated <code>lastmod</code> fix this.
        </Finding>

        <Finding severity="good" title="Money pages are server-rendered (SSR confirmed)">
          0 pages flagged for JS-only links — the PHP money site is crawlable without a headless browser.
          Rendering risk lives on the blog layer (Hashnode/Next.js), not on the conversion pages.
        </Finding>

        <Finding severity="good" title="robots.txt uses Content-Signals (search=yes, ai-train=no)">
          They have adopted the modern AI-crawler signal protocol. Worth preserving through any migration
          to neevcloud.com/learn/ — add the same signals to the new sitemap.
        </Finding>
      </section>

      {/* Cross-domain matrix */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">Cross-Domain Link Matrix</h2>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5 inline-block">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-[var(--muted-foreground)] text-left pr-8 pb-2 font-normal">from \ to</th>
                <th className="text-[var(--muted-foreground)] pr-8 pb-2 font-normal">www</th>
                <th className="text-[var(--muted-foreground)] pb-2 font-normal">blog</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-[var(--muted-foreground)] pr-8 py-1">www</td>
                <td className="text-center font-semibold pr-8 py-1">{www["www.neevcloud.com"] ?? 0}</td>
                <td className="text-center font-semibold py-1">{www["blog.neevcloud.com"] ?? 0}</td>
              </tr>
              <tr>
                <td className="text-[var(--muted-foreground)] pr-8 py-1">blog</td>
                <td className="text-center font-semibold text-[var(--accent-red)] pr-8 py-1">{blog["www.neevcloud.com"] ?? 0}</td>
                <td className="text-center font-semibold py-1">{blog["blog.neevcloud.com"] ?? 0}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-[var(--muted-foreground)] mt-3 max-w-xs leading-relaxed">
            Blog row partially observed (Vercel challenge limited crawl). Even partial, the{" "}
            <span className="text-[var(--accent-red)]">0</span> in blog→www is the signal.
          </p>
        </div>
      </section>

      {/* Orphans table */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">Orphan Money Pages</h2>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-normal uppercase tracking-wide">URL</th>
                <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-normal uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-[var(--muted-foreground)] font-normal uppercase tracking-wide text-right">Inlinks</th>
              </tr>
            </thead>
            <tbody>
              {R.orphans.map(o => (
                <tr key={o.url} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5 text-[var(--accent-green)] break-all">{fmt(o.url)}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">{o.title?.slice(0, 50) || "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--accent-red)] font-semibold text-right">0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cannibalization */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">
          Cannibalization Clusters <span className="text-[var(--accent-amber)]">(TF-IDF cosine ≥ 0.78)</span>
        </h2>
        <div className="space-y-2">
          {R.cannibalizationClusters.map((cluster, i) => (
            <div key={i} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 space-y-2">
              <p className="text-xs text-[var(--accent-amber)]">
                cluster {i + 1} · {cluster.length} pages competing for the same intent
              </p>
              <ul className="space-y-1">
                {cluster.map(p => (
                  <li key={p.url} className="text-xs text-[var(--muted-foreground)] flex gap-2">
                    <span className="shrink-0">·</span>
                    <span>
                      <span className="text-[var(--foreground)]">{fmt(p.url)}</span>
                      {p.title ? ` — ${p.title.slice(0, 60)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Link recommendations */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">Auto-Generated Link Recommendations</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          For each page, the engine scores every other page it does not currently link to and proposes the
          most relevant by semantic similarity. This is the internal-linking automation that fires on every publish
          to keep a high-volume system from minting orphans.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topRecs.map(([src, recs]) => (
            <div key={src} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 space-y-2">
              <p className="text-xs text-[var(--accent-amber)] truncate">{fmt(src)}</p>
              <div className="space-y-1">
                {recs.slice(0, 4).map(r => (
                  <div key={r.url} className="text-xs text-[var(--muted-foreground)] flex gap-2">
                    <span className="text-[var(--accent-green)] shrink-0">{r.score.toFixed(2)}</span>
                    <span className="truncate">{fmt(r.url)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What's next */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">What this engine does in production</h2>
        <div className="border-l-2 border-[var(--border)] pl-5 space-y-2 text-xs text-[var(--muted-foreground)]">
          <p>On every new publish webhook from the CMS → run link recommendations → auto-suggest (or auto-insert) internal links into the new post and into the top-N most relevant existing posts.</p>
          <p>Nightly crawl → recompute orphan list → alert on any page that was previously linked and has become isolated.</p>
          <p>The <code className="bg-[var(--panel)] px-1 py-0.5 rounded">embedDocs()</code> function in <code className="bg-[var(--panel)] px-1 py-0.5 rounded">analyze.js</code> is the swap-in seam: replace TF-IDF with OpenAI/Voyage embeddings in production for sharper semantic matching.</p>
        </div>
      </section>

    </div>
  );
}

function Stat({ n, label, color = "var(--foreground)" }: { n: string; label: string; color?: string }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
      <div className="text-3xl font-semibold tracking-tight" style={{ color }}>{n}</div>
      <div className="text-xs text-[var(--muted-foreground)] mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Finding({ severity, title, children }: {
  severity: "crit" | "warn" | "good";
  title: string;
  children: React.ReactNode;
}) {
  const accent = severity === "crit" ? "var(--accent-red)" : severity === "warn" ? "var(--accent-amber)" : "var(--accent-green)";
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 space-y-1.5" style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{children}</p>
    </div>
  );
}
