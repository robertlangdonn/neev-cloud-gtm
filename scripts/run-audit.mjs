#!/usr/bin/env node
/**
 * NeevCloud site audit — www.neevcloud.com only.
 *
 * blog.neevcloud.com is hosted on Hashnode behind a Vercel security checkpoint
 * that returns HTTP 429 for all automated crawlers (every user-agent, including
 * spoofed Googlebot). The Hashnode public GraphQL API (gql.hashnode.com) was
 * deprecated in 2025 and now redirects to an announcement page. We document
 * this as a finding rather than silently failing.
 *
 * Usage:  node scripts/run-audit.mjs
 *         node scripts/run-audit.mjs --delay 400 --out data/audit.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const arg = (k, def) => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : def; };
const DELAY_MS = parseInt(arg('--delay', '400'), 10);
const OUT = path.resolve(ROOT, arg('--out', 'data/audit.json'));
const WWW_SEED = 'https://www.neevcloud.com';

const UA = 'Mozilla/5.0 (compatible; NeevSEOAudit/2.0; +https://prasadkhake.com)';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hostOf(url) { try { return new URL(url).host; } catch { return ''; } }

function normalizeUrl(raw, base) {
  try {
    const u = new URL(raw.trim(), base);
    u.hash = '';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid']
      .forEach(p => u.searchParams.delete(p));
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

async function fetchText(url, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept': 'text/html,application/xml,text/xml,*/*' },
      redirect: 'follow', signal: ac.signal,
    });
    return { status: res.status, finalUrl: res.url, body: await res.text(), ok: res.ok };
  } catch (e) {
    return { status: 0, finalUrl: url, body: '', ok: false, error: e.message };
  } finally { clearTimeout(t); }
}

async function discoverViaSitemap(seed) {
  const base = new URL(seed);
  const issues = [];
  const found = new Set();
  const robotsMeta = { sitemaps: [], contentSignals: [] };

  const robotsRes = await fetchText(`${base.origin}/robots.txt`);
  await sleep(DELAY_MS);

  if (robotsRes.ok) {
    for (const line of robotsRes.body.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase(), val = m[2].trim();
      if (key === 'sitemap') robotsMeta.sitemaps.push(val);
      if (key === 'content-signal') robotsMeta.contentSignals.push(val);
    }
  }

  const sitemapUrls = robotsMeta.sitemaps.length
    ? robotsMeta.sitemaps
    : [`${base.origin}/sitemap.xml`];

  const visited = new Set();
  const queue = [...sitemapUrls];

  while (queue.length) {
    const sm = queue.shift();
    if (visited.has(sm)) continue;
    visited.add(sm);

    const res = await fetchText(sm);
    await sleep(DELAY_MS);

    if (!res.ok) { issues.push({ type: 'sitemap_unreachable', url: sm, status: res.status }); continue; }

    if (/Security Checkpoint|cf-browser-verification|challenge/i.test(res.body)
        && !res.body.includes('<urlset') && !res.body.includes('<sitemapindex')) {
      issues.push({ type: 'sitemap_bot_challenge', url: sm, status: res.status });
      continue;
    }

    const children = [...res.body.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
    children.forEach(c => queue.push(c));

    const locs = [...res.body.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    for (const loc of locs) {
      if (loc !== loc.trim()) issues.push({ type: 'sitemap_whitespace_defect', url: loc });
      const n = normalizeUrl(loc, base.origin);
      if (n) found.add(n);
    }
  }

  console.error(`  sitemap: ${found.size} URLs, ${issues.length} issues`);
  return { urls: [...found], robotsMeta, issues };
}

async function crawlBFS(seed, seedUrls = [], maxPages = 500) {
  const base = new URL(seed);
  const seen = new Set();
  const pages = new Map();
  const queue = (seedUrls.length ? seedUrls : [base.origin + '/']).map(u => ({ url: u, depth: 0 }));
  let fetched = 0;

  while (queue.length && fetched < maxPages) {
    const { url, depth } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    if (hostOf(url) !== base.host) continue;

    const res = await fetchText(url);
    await sleep(DELAY_MS);
    fetched++;
    if (fetched % 10 === 0) process.stderr.write(`  crawled ${fetched} pages...\r`);

    if (!res.ok) {
      pages.set(url, { url, status: res.status, title: '', h1: '', outlinks: [], wordCount: 0 });
      continue;
    }
    if (!/<html/i.test(res.body.slice(0, 500))) continue;

    const $ = cheerio.load(res.body);
    const title = $('title').first().text().trim();
    const h1 = $('h1').first().text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    $('script,style,noscript').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const outlinks = [];
    $('a[href]').each((_, el) => {
      const n = normalizeUrl($(el).attr('href'), url);
      if (n) outlinks.push({ href: n, anchor: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120) });
    });
    const renderFlag = text.length < 250 && outlinks.length < 3;
    pages.set(url, {
      url, status: res.status, title, h1, metaDesc, canonical, robotsMeta,
      wordCount: text.split(' ').filter(Boolean).length,
      text: text.slice(0, 5000), outlinks, renderFlag,
    });
    if (depth < 4) {
      for (const { href } of outlinks) {
        if (hostOf(href) === base.host && !seen.has(href)) queue.push({ url: href, depth: depth + 1 });
      }
    }
  }
  console.error(`\n  crawled ${pages.size} pages`);
  return pages;
}

function buildLinkGraph(pages) {
  const urls = [...pages.keys()];
  const urlSet = new Set(urls);
  const inbound = new Map(urls.map(u => [u, []]));
  const outbound = new Map(urls.map(u => [u, []]));
  for (const [url, p] of pages) {
    const seen = new Set();
    for (const { href } of (p.outlinks || [])) {
      if (href === url || seen.has(href)) continue;
      seen.add(href);
      if (urlSet.has(href)) { outbound.get(url).push(href); inbound.get(href).push(url); }
    }
  }
  return { inbound, outbound, urls };
}

function findOrphans(graph, pages) {
  return graph.urls.filter(u => {
    const p = pages.get(u);
    if (!p || (p.robotsMeta || '').includes('noindex')) return false;
    return (graph.inbound.get(u) || []).length === 0;
  });
}

function tokenize(text) {
  const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the to was were will with this you your we our not but if then so can gpu ai cloud neevcloud'.split(' '));
  return (text || '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(t => !STOP.has(t)) || [];
}

function tfidf(docs) {
  const df = new Map();
  const tfs = docs.map(d => {
    const counts = new Map();
    const toks = tokenize(d);
    toks.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    new Set(toks).forEach(t => df.set(t, (df.get(t) || 0) + 1));
    return { counts, len: toks.length || 1 };
  });
  const N = docs.length;
  return tfs.map(({ counts, len }) => {
    const v = new Map();
    for (const [t, c] of counts) {
      const idf = Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
      v.set(t, (c / len) * idf);
    }
    return v;
  });
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, y] of b) nb += y * y;
  const small = a.size < b.size ? a : b, large = a.size < b.size ? b : a;
  for (const [t, x] of small) { const y = large.get(t); if (y) dot += x * y; }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function findCannibalization(pages, threshold = 0.78) {
  const entries = [...pages.values()].filter(p => p.title && p.wordCount > 50);
  const texts = entries.map(p => `${p.title} ${p.h1} ${p.metaDesc || ''} ${(p.text || '').slice(0, 4000)}`);
  const vecs = tfidf(texts);
  const used = new Set();
  const clusters = [];
  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < entries.length; j++) {
      if (!used.has(j) && cosine(vecs[i], vecs[j]) >= threshold) { group.push(j); used.add(j); }
    }
    if (group.length > 1) { group.forEach(g => used.add(g)); clusters.push(group.map(g => ({ url: entries[g].url, title: entries[g].title }))); }
  }
  return clusters;
}

function recommendLinks(pages, graph, topN = 5) {
  const entries = [...pages.values()].filter(p => p.title && p.wordCount > 50);
  const idx = new Map(entries.map((p, i) => [p.url, i]));
  const texts = entries.map(p => `${p.title} ${p.h1} ${(p.text || '').slice(0, 4000)}`);
  const vecs = tfidf(texts);
  const recs = {};
  for (const p of entries) {
    const i = idx.get(p.url);
    if (i === undefined) continue;
    const already = new Set(graph.outbound.get(p.url) || []);
    const scored = [];
    for (const q of entries) {
      if (q.url === p.url || already.has(q.url)) continue;
      const j = idx.get(q.url);
      if (j === undefined) continue;
      const sim = cosine(vecs[i], vecs[j]);
      if (sim >= 0.10) scored.push({ url: q.url, title: q.title, score: +sim.toFixed(3) });
    }
    scored.sort((a, b) => b.score - a.score);
    if (scored.length) recs[p.url] = scored.slice(0, topN);
  }
  return recs;
}

function crossDomainGaps(pages, graph) {
  const hosts = [...new Set(graph.urls.map(hostOf))].filter(Boolean);
  const matrix = {};
  for (const h of hosts) matrix[h] = {};
  for (const [from, tos] of graph.outbound) {
    const fh = hostOf(from);
    for (const to of tos) {
      const th = hostOf(to);
      if (fh && th) matrix[fh][th] = (matrix[fh][th] || 0) + 1;
    }
  }
  return { hosts, matrix };
}

function summarize(pages, graph) {
  const total = graph.urls.length;
  const indexable = graph.urls.filter(u => !(pages.get(u)?.robotsMeta || '').includes('noindex')).length;
  const inboundCounts = graph.urls.map(u => (graph.inbound.get(u) || []).length);
  const avg = inboundCounts.reduce((a, b) => a + b, 0) / (total || 1);
  return {
    totalPages: total, indexablePages: indexable,
    avgInternalInlinks: +avg.toFixed(2),
    pagesWithZeroInlinks: inboundCounts.filter(c => c === 0).length,
  };
}

async function main() {
  console.error('NeevCloud site audit — www.neevcloud.com\n');

  const sitemap = await discoverViaSitemap(WWW_SEED);
  const pages = await crawlBFS(WWW_SEED, sitemap.urls, 500);

  console.error('\nRunning analysis...');
  const graph = buildLinkGraph(pages);
  const summary = summarize(pages, graph);
  const orphans = findOrphans(graph, pages);
  const cannibal = findCannibalization(pages);
  const recs = recommendLinks(pages, graph);
  const xdomain = crossDomainGaps(pages, graph);

  console.error(`orphans: ${orphans.length} | cannibal clusters: ${cannibal.length}`);

  const report = {
    generatedAt: new Date().toISOString(),
    seeds: ['www.neevcloud.com'],
    config: { crawlCap: 500, delayMs: DELAY_MS },
    blogNote: 'blog.neevcloud.com is hosted on Hashnode behind a Vercel security checkpoint (HTTP 429 for all bot user-agents). The Hashnode public GraphQL API (gql.hashnode.com) was deprecated in 2025. Blog analysis is not available via automated crawl — see audit findings for the SEO implications.',
    perDomain: [
      {
        domain: 'www.neevcloud.com',
        sitemapUrlCount: sitemap.urls.length,
        crawledPageCount: pages.size,
        robotsBlocksAll: false,
        robotsSitemaps: sitemap.robotsMeta.sitemaps,
        robotsContentSignals: sitemap.robotsMeta.contentSignals,
        sitemapIssues: sitemap.issues,
      },
      {
        domain: 'blog.neevcloud.com',
        sitemapUrlCount: 0,
        crawledPageCount: 0,
        robotsBlocksAll: false,
        robotsSitemaps: [],
        robotsContentSignals: [],
        sitemapIssues: [
          {
            type: 'domain_inaccessible',
            url: 'https://blog.neevcloud.com',
            status: 429,
            note: 'Entire subdomain behind Vercel security checkpoint. HTTP 429 returned for all crawlers regardless of user-agent. ~234 posts estimated but unauditable via automation. Hashnode public API deprecated 2025. Fix: migrate to neevcloud.com/learn/ for full auditability.'
          }
        ],
      },
    ],
    corpus: summary,
    crossDomain: xdomain,
    orphans: orphans.map(u => ({ url: u, title: pages.get(u)?.title ?? '' })),
    cannibalizationClusters: cannibal,
    linkRecommendations: Object.fromEntries(Object.entries(recs).slice(0, 300)),
    pages: [...pages.values()].map(p => ({
      url: p.url, host: hostOf(p.url),
      status: p.status, title: p.title, h1: p.h1, wordCount: p.wordCount,
      inlinks: (graph.inbound.get(p.url) || []).length,
      outlinks: (graph.outbound.get(p.url) || []).length,
      renderFlag: !!p.renderFlag, robotsMeta: p.robotsMeta || '',
    })),
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.error(`\n✓ ${OUT}`);
  console.error(`  ${summary.totalPages} pages | avg inlinks: ${summary.avgInternalInlinks} | orphans: ${orphans.length} | cannibal: ${cannibal.length}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
