import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { cluster_name, keywords, serp_gap, opportunity_score, content_type } = await req.json();

  if (!cluster_name) {
    return Response.json({ error: "cluster_name required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const topKeywords = (keywords ?? [])
    .slice(0, 6)
    .map((k: { keyword: string; volume: number; intent: string } | string) => {
      if (typeof k === "string") return k;
      return `${k.keyword} (vol: ${k.volume?.toLocaleString() ?? "?"}, intent: ${k.intent ?? "?"})`;
    })
    .join("\n");

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: [
      {
        type: "text",
        text: `You are a senior content strategist for NeevCloud, an AI-first sovereign cloud and GPU compute company in India. You write for a technical senior audience: platform engineering leads, CTOs, heads of infrastructure, AI/ML leads, and procurement in BFSI, public sector, and healthcare.

Your briefs are engineering documents, not marketing material. Every section must be defensibly useful to a senior technical buyer. No vague claims, no hallucinated benchmarks. Flag anything that needs verification before publishing.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Generate a structured content brief for this topic cluster.

CLUSTER: ${cluster_name}
CONTENT TYPE: ${content_type ?? "editorial"}
OPPORTUNITY SCORE: ${opportunity_score ?? "N/A"}/100

TOP KEYWORDS:
${topKeywords}

SERP GAP:
${serp_gap ?? "Not provided"}

Output a structured brief with these sections:
1. **Recommended title** (SEO-optimised, specific, no clickbait)
2. **Target persona** (specific role, company type, what they're trying to accomplish)
3. **Search intent** (what the reader wants to know or do)
4. **SERP gap** (what's missing from current top results that this post provides)
5. **Recommended word count and content depth**
6. **Required H2 sections** (5-7 sections with one-line description each)
7. **E-E-A-T signals to include** (specific data, credentials, first-party sources to cite)
8. **Claims to verify before publishing** (anything that could be a compliance risk or unverifiable)
9. **Internal linking targets** (2-3 existing content types to link to)
10. **CTA** (what should a reader do after reading this?)`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
    cancel() { stream.abort(); },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    },
  });
}
