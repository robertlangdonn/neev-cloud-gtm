// Free sources: Google Autocomplete (no key), Google Trends RSS (no key)
// Paid source: DataForSEO (volume + CPC + intent) — only called if credentials present

async function googleAutocomplete(seed: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=en&gl=in`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    // Response: [query, [suggestion1, suggestion2, ...]]
    return (data[1] as string[]) ?? [];
  } catch {
    return [];
  }
}

async function googleTrendsRelated(keyword: string): Promise<string[]> {
  try {
    // Google Trends related queries via the explore endpoint (unofficial, free)
    const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(keyword)}?hl=en-IN&geo=IN`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    // Response starts with ")]}',\n" — strip it
    const json = JSON.parse(text.replace(/^\)]\}',\n/, ""));
    const items: Array<{ title: string }> = json?.default?.topics ?? [];
    return items.slice(0, 5).map(t => t.title);
  } catch {
    return [];
  }
}

async function dataforSEOVolume(
  keywords: string[],
  login: string,
  password: string
): Promise<Map<string, { volume: number; cpc: number; competition: number; intent: string; monthly_trend: number[] }>> {
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keywords: keywords.slice(0, 20), location_code: 2356, language_code: "en", search_partners: false }]),
  });

  if (!res.ok) throw new Error(`DataForSEO ${res.status}`);
  const data = await res.json();
  const items: Array<{
    keyword: string; search_volume: number; cpc: number;
    competition: number; search_intent?: string;
    monthly_searches?: Array<{ search_volume: number }>;
  }> = data?.tasks?.[0]?.result ?? [];

  const map = new Map();
  for (const item of items) {
    map.set(item.keyword, {
      volume: item.search_volume ?? 0,
      cpc: item.cpc ?? 0,
      competition: item.competition ?? 0,
      intent: item.search_intent ?? "informational",
      monthly_trend: item.monthly_searches?.slice(-3).map(m => m.search_volume) ?? [],
    });
  }
  return map;
}

export async function POST(req: Request) {
  const { keywords, seed } = await req.json() as { keywords?: string[]; seed?: string };

  const keywordList: string[] = keywords ?? [];

  // If a seed topic is given, expand it for free via Google Autocomplete
  let suggestions: string[] = [];
  if (seed) {
    const [autocomplete, trends] = await Promise.all([
      googleAutocomplete(seed),
      googleTrendsRelated(seed),
    ]);
    suggestions = [...new Set([...autocomplete, ...trends])].slice(0, 15);
  }

  const allKeywords = [...new Set([...keywordList, ...suggestions])];

  if (allKeywords.length === 0) {
    return Response.json({ error: "provide keywords array or seed string" }, { status: 400 });
  }

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  // Enrich with DataForSEO volume if credentials present; otherwise return free data only
  let volumeMap = new Map<string, { volume: number; cpc: number; competition: number; intent: string; monthly_trend: number[] }>();
  let source = "google_autocomplete";

  if (login && password) {
    try {
      volumeMap = await dataforSEOVolume(allKeywords, login, password);
      source = "dataforseo+google_autocomplete";
    } catch (e) {
      console.error("DataForSEO failed, returning autocomplete only:", e);
    }
  }

  const result = allKeywords.map(kw => {
    const dfs = volumeMap.get(kw);
    return {
      keyword: kw,
      volume: dfs?.volume ?? null,
      cpc: dfs?.cpc ?? null,
      competition: dfs?.competition ?? null,
      intent: dfs?.intent ?? "informational",
      monthly_trend: dfs?.monthly_trend ?? [],
      from_autocomplete: !keywordList.includes(kw),
    };
  });

  return Response.json({
    keywords: result,
    suggestions_added: suggestions.length,
    source,
    location: "India",
  });
}
