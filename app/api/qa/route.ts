import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { content, title } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (!content || content.trim().length < 50) {
    return Response.json({ error: "Content too short (min 50 chars)" }, { status: 400 });
  }

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: `You are a quality gate for NeevCloud's content pipeline. Score content STRICTLY and flag specific problems.

NeevCloud sells to CTOs, platform engineers, and BFSI/government procurement. Every published URL must be defensibly useful to a senior technical buyer. Thin, generic, or hallucinated content damages the domain and is a compliance risk.

Be a harsh critic. A score of 8+ means genuinely excellent. Most AI-generated content scores 5-6. You MUST always return ALL fields including flags (as an array, empty if none) and summary.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: "qa_score",
        description: "Return structured QA scores for the content",
        input_schema: {
          type: "object" as const,
          properties: {
            depth: {
              type: "number",
              description: "0-10. Technical concept density, word count adequacy, code/data evidence, specific examples vs. generic claims.",
            },
            eeat: {
              type: "number",
              description: "0-10. Author entity signals, citation density, experience markers, external data references, schema-eligible claims.",
            },
            originality: {
              type: "number",
              description: "0-10. First-party data, unique perspective, India-specific context, SERP gap filled.",
            },
            hallucination_risk: {
              type: "number",
              description: "0-10 where 10 = HIGH RISK. Specific numbers without sources, named products/prices that could be wrong, regulatory claims without citations.",
            },
            brand_safety: {
              type: "number",
              description: "0-10 where 10 = HIGH RISK. Competitor mentions, unverified pricing, internal data leakage risk, compliance-sensitive language.",
            },
            verdict: {
              type: "string",
              enum: ["PASS", "REVIEW", "FAIL"],
              description: "PASS if avg(depth+eeat+originality) >= 7 AND hallucination_risk <= 4 AND brand_safety <= 3. REVIEW if borderline. FAIL otherwise.",
            },
            flags: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  severity: { type: "string", enum: ["critical", "warning", "info"] },
                  issue: { type: "string" },
                  suggestion: { type: "string" },
                },
                required: ["dimension", "severity", "issue", "suggestion"],
              },
              description: "Specific actionable issues. Quote problematic text when possible. Return empty array [] if no issues.",
            },
            summary: {
              type: "string",
              description: "2-3 sentence honest assessment. What's good, what's missing, what would make this pass.",
            },
          },
          required: ["depth", "eeat", "originality", "hallucination_risk", "brand_safety", "verdict", "flags", "summary"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "qa_score" },
    messages: [
      {
        role: "user",
        content: `Score this content for NeevCloud's quality gate.\n\nTITLE: ${title || "(untitled)"}\n\nCONTENT:\n${content.slice(0, 6000)}`,
      },
    ],
  });

  const toolUse = msg.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "Model did not return scores" }, { status: 500 });
  }

  const raw = toolUse.input as Record<string, unknown>;

  const depth = Number(raw.depth ?? 0);
  const eeat = Number(raw.eeat ?? 0);
  const originality = Number(raw.originality ?? 0);

  return Response.json({
    depth,
    eeat,
    originality,
    hallucination_risk: Number(raw.hallucination_risk ?? 0),
    brand_safety: Number(raw.brand_safety ?? 0),
    verdict: (raw.verdict as string) ?? "REVIEW",
    flags: Array.isArray(raw.flags) ? raw.flags : [],
    summary: (raw.summary as string) ?? "",
    quality_avg: parseFloat(((depth + eeat + originality) / 3).toFixed(1)),
    scored_at: new Date().toISOString(),
  });
}
