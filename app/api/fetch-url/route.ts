export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json({ error: "Only http/https URLs allowed" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(parsed.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentAuditBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({ error: `Fetch failed: HTTP ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return Response.json({ error: "URL does not return HTML content" }, { status: 422 });
    }

    html = await res.text();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return Response.json({ error: `Could not fetch URL: ${msg}` }, { status: 502 });
  }

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : parsed.hostname;

  // Extract meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const metaDesc = metaMatch ? metaMatch[1].trim() : "";

  // Strip scripts, styles, nav, footer, header, aside
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract main/article content if present
  const articleMatch = clean.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (articleMatch) clean = articleMatch[1];

  // Strip remaining HTML tags
  const text = clean
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 50) {
    return Response.json({
      error: "Page has too little readable text (may be paywalled, JavaScript-rendered, or bot-protected)",
    }, { status: 422 });
  }

  return Response.json({
    title,
    meta_description: metaDesc,
    content: text.slice(0, 8000),
    word_count: wordCount,
    url: parsed.href,
  });
}
