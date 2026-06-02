import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

interface KeywordInput {
  keyword: string;
  volume?: number;
  cpc?: number;
  intent?: string;
}

export async function POST(req: Request) {
  const { keywords, topic } = await req.json() as { keywords: KeywordInput[]; topic?: string };

  if ((!keywords || keywords.length === 0) && !topic) {
    return Response.json({ error: "keywords array or topic string required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const keywordList = keywords ?? [];

  // Semantic pre-clustering with embeddings when we have enough keywords
  let embeddingClusters: string[][] = [];
  if (keywordList.length >= 6 && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const texts = keywordList.map(k => k.keyword);
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      });
      embeddingClusters = greedyClusters(texts, embRes.data.map(d => d.embedding), 0.82);
    } catch { /* fall through */ }
  }

  const kwText = keywordList.length > 0
    ? keywordList.map(k => `${k.keyword} (vol: ${k.volume ?? "?"}, intent: ${k.intent ?? "?"}, cpc: $${k.cpc ?? "?"})`).join("\n")
    : `Topic: ${topic}`;

  const embHint = embeddingClusters.length > 0
    ? `\nEmbedding pre-clusters (cosine ≥ 0.82):\n${embeddingClusters.map((g, i) => `  Group ${i + 1}: ${g.join(", ")}`).join("\n")}`
    : "";

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: `You are a keyword strategist for NeevCloud, an AI-first sovereign cloud and GPU compute company in India. Cluster keywords into topic groups and score them by business opportunity for NeevCloud specifically. NeevCloud's competitive moat: India-sovereign infrastructure, GPU compute, BFSI/government compliance. Respond ONLY with valid JSON matching the requested schema exactly. No markdown, no explanation.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Cluster these keywords and score each cluster for NeevCloud's content strategy.\n${kwText}${embHint}\n\nReturn JSON:\n{"clusters":[{"name":"string","tier":1|2|3,"content_type":"pillar"|"programmatic"|"longtail","opportunity_score":0-100,"primary_keyword":"string","rationale":"string","serp_gap":"string","keywords":["string"],"recommended_title":"string"}]}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Model did not return valid JSON", raw: text.slice(0, 300) }, { status: 500 });
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return Response.json({ ...result, source: "claude-haiku+embeddings", clustered_at: new Date().toISOString() });
  } catch {
    return Response.json({ error: "Failed to parse model response", raw: text.slice(0, 300) }, { status: 500 });
  }
}

function greedyClusters(texts: string[], vecs: number[][], threshold: number): string[][] {
  const used = new Set<number>();
  const groups: string[][] = [];
  for (let i = 0; i < texts.length; i++) {
    if (used.has(i)) continue;
    const group = [texts[i]];
    used.add(i);
    for (let j = i + 1; j < texts.length; j++) {
      if (!used.has(j) && cosine(vecs[i], vecs[j]) >= threshold) {
        group.push(texts[j]);
        used.add(j);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
