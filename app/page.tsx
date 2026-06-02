import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-14 space-y-16">

      {/* Hero */}
      <section className="space-y-4">
        <p className="text-xs tracking-widest uppercase text-[var(--accent-green)]">
          GTM Engineer · Case Study Prototype · live run on neevcloud.com
        </p>
        <h1 className="text-3xl font-semibold tracking-tight leading-tight">
          80 indexed posts/week<br />
          <span className="text-[var(--muted-foreground)] font-normal">without killing the domain.</span>
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] max-w-2xl leading-relaxed">
          Publishing 80/week is trivial. Getting them indexed, ranking, and not dragging down the rest
          of the domain on a low-trust domain is the hard part. This engine is the infrastructure layer
          that makes volume safe: cross-domain link graph, keyword clustering, streaming brief generation,
          and a quality gate that blocks thin content before it ships.
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/audit"
            className="px-4 py-2 text-sm bg-[var(--accent-green)] text-[#0e0e10] rounded font-medium hover:opacity-90 transition-opacity"
          >
            View site audit →
          </Link>
          <Link
            href="/pipeline"
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--foreground)] rounded hover:bg-[var(--panel)] transition-colors"
          >
            Try the pipeline →
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { n: "80", label: "indexed posts/week", color: "var(--accent-green)" },
          { n: "$0.70", label: "cost per indexed post", color: "var(--foreground)" },
          { n: "6", label: "orphan money pages found", color: "var(--accent-red)" },
          { n: "0", label: "blog→www equity links", color: "var(--accent-red)" },
        ].map(({ n, label, color }) => (
          <div key={label} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-3xl font-semibold tracking-tight" style={{ color }}>{n}</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </section>

      {/* Architecture */}
      <section className="space-y-4">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">System Architecture</h2>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-6 overflow-x-auto">
          <pre className="text-xs text-[var(--muted-foreground)] leading-relaxed whitespace-pre">{
`  GSC query mining       DataForSEO              Google Autocomplete
  (rank > 10 queries)    (volume · CPC · SERP)   (free · no key needed)
         │                      │                        │
         └──────────────────────┴────────────────────────┘
                                │
                          ┌─────▼──────┐
                          │  keyword   │  OpenAI embeddings
                          │  cluster   │◄── semantic grouping
                          │  + score   │    opportunity scoring
                          └─────┬──────┘
                                │  T1: 8 editorial pillars/week
                                │  T2: 52 programmatic pages/week
                                │  T3: 20 long-tail/week
                          ┌─────▼──────┐
                          │   brief    │  Claude claude-sonnet-4-6
                          │ generator  │◄── SERP gap · E-E-A-T req.
                          │ (streaming)│    persona · intent
                          └─────┬──────┘
                                │
                          ┌─────▼──────┐
                          │  QA gate   │  Claude structured output
                          │  (5 dims)  │◄── depth · E-E-A-T · originality
                          └─────┬──────┘    hallucination risk · brand safety
                                │
                          ┌─────▼──────┐
                          │    CMS     │  webhook → publish → sitemap ping
                          │  publish   │  internal-linking engine fires
                          └─────┬──────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                        │
   ┌──────▼──────┐   ┌──────────▼──────┐   ┌───────────▼────────┐
   │ link graph  │   │  indexation     │   │   attribution      │
   │ + orphan    │   │  monitor        │   │   GA4 → HubSpot    │
   │ detection   │   │  kill-switch    │   │   content→pipeline │
   └─────────────┘   └─────────────────┘   └────────────────────┘`
          }</pre>
        </div>
      </section>

      {/* Volume trap */}
      <section className="space-y-4">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">The Volume Trap</h2>
        <div className="border-l-2 border-[var(--accent-amber)] pl-5 space-y-3 text-sm">
          <p className="text-[var(--muted-foreground)]">
            <span className="text-[var(--foreground)] font-medium">80/week of editorial long-form on blog.neevcloud.com is the wrong shape.</span>{" "}
            Google evaluates quality at the site level. Flood a low-trust domain with 4,000+ pages/year and
            you risk site-wide demotion, partial indexation, and crawl budget starvation on the money pages.
          </p>
          <p className="text-[var(--muted-foreground)]">
            <span className="text-[var(--foreground)] font-medium">The right shape is a hybrid.</span>{" "}
            8 deep editorial pillars/week on a{" "}
            <code className="text-xs bg-[var(--panel)] px-1 py-0.5 rounded">/learn/</code> subdirectory of{" "}
            <code className="text-xs bg-[var(--panel)] px-1 py-0.5 rounded">neevcloud.com</code>{" "}
            (not the Hashnode subdomain) maintain E-E-A-T. 52 programmatic pages/week from real datasets
            NeevCloud already has — GPU SKU × region × workload, pricing comparisons — provide the volume.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { tier: "Tier 1 · Editorial spine", n: "8/week", desc: "Deep pillars. Real authors, citations, first-party benchmarks. On neevcloud.com/learn/. These are the E-E-A-T anchors." },
            { tier: "Tier 2 · Programmatic substrate", n: "52/week", desc: "Templated pages over real data: GPU SKUs, pricing comparisons, compliance matrices. NeevCloud already builds these manually — this systematises it." },
            { tier: "Tier 3 · Long-tail spokes", n: "20/week", desc: "FAQ and comparison pages targeting specific queries. Generated at low cost, linked into the pillar structure. Pruned at 90 days if no impressions." },
          ].map(({ tier, n, desc }) => (
            <div key={tier} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 space-y-2">
              <div className="text-[var(--muted-foreground)] uppercase tracking-wide text-xs">{tier}</div>
              <div className="text-2xl font-semibold text-[var(--accent-green)]">{n}</div>
              <p className="text-[var(--muted-foreground)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="space-y-4">
        <h2 className="text-xs tracking-widest uppercase text-[var(--muted-foreground)]">What&apos;s built</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FeatureCard
            href="/audit"
            title="Site Audit"
            tag="live run"
            tagColor="var(--accent-green)"
            description="Cross-domain link graph, orphan detection, cannibalization clustering, and link recommendations. Ran live against neevcloud.com."
            findings={[
              "blog→www links = 0 (split-brain)",
              "6 orphan GPU money pages",
              "7-page cannibalization cluster",
              "Blog sitemap behind 429 checkpoint",
            ]}
          />
          <FeatureCard
            href="/pipeline"
            title="Content Pipeline"
            tag="Claude + DataForSEO"
            tagColor="var(--accent-amber)"
            description="Keyword clustering → opportunity scoring → streaming brief generation. Pre-fetched data + live mode."
            findings={[
              "5 topic clusters pre-loaded",
              "Streaming brief generation",
              "SERP gap analysis per cluster",
              "Live keyword lookup",
            ]}
          />
          <FeatureCard
            href="/qa"
            title="QA Gate"
            tag="live · Claude API"
            tagColor="var(--accent-amber)"
            description="5-dimension quality scoring before any content ships. PASS / REVIEW / FAIL with specific flagged lines."
            findings={[
              "Depth & technical density",
              "E-E-A-T signal scoring",
              "Hallucination risk detection",
              "Brand safety & compliance",
            ]}
          />
        </div>
      </section>

    </div>
  );
}

function FeatureCard({ href, title, tag, tagColor, description, findings }: {
  href: string; title: string; tag: string; tagColor: string;
  description: string; findings: string[];
}) {
  return (
    <Link href={href} className="block bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5 hover:border-[var(--muted-foreground)] transition-colors group space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm group-hover:text-[var(--accent-green)] transition-colors">{title}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full border shrink-0" style={{ color: tagColor, borderColor: tagColor + "55" }}>{tag}</span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{description}</p>
      <ul className="space-y-1">
        {findings.map(f => (
          <li key={f} className="text-xs text-[var(--muted-foreground)] flex gap-2">
            <span className="text-[var(--border)] shrink-0 mt-0.5">·</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="text-xs text-[var(--accent-green)] group-hover:underline">Open →</div>
    </Link>
  );
}
