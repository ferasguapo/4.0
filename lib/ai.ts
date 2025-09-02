export type NormalizedData = {
  overview: string;
  diagnostic_steps: string[];
  repair_steps: string[];
  tools_needed: string[];
  time_estimate: string;
  cost_estimate: string;
  parts: string[];    // Will remain empty; use your generated links instead
  videos: string[];   // Will remain empty; use your generated links instead
};

/** Call Groq AI provider and return detailed beginner-friendly JSON */
export async function callAI(
  prompt: string,
  model: string = "llama-3.3-70b-versatile",
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const systemPrompt = `
You are obuddy5000, a professional auto mechanic assistant.

Your job: create **extremely detailed, beginner-friendly repair guides**. 
Assume the user has never worked on a car before.

Formatting rules:
- Always return valid JSON matching the schema.
- Each item in diagnostic_steps and repair_steps must be a **full paragraph (minimum 3–5 sentences)**, written in clear, simple language.
- Write like a professional repair manual, but explain the "why" behind each action.

Diagnostic steps:
- Guide the user logically through tests to isolate the problem.
- For each step, explain **what to do, how to do it, what tools to use, what results to look for, and what each result means**.
- Mention common mistakes and safety precautions.

Repair steps:
- Provide **manual-style instructions**: which bolts to remove, what size tools are needed, how to reinstall.
- Add safety tips, what to double-check, and what the final outcome should look like.

Tools:
- List every tool with exact size/type (e.g., "10mm deep socket with extension", "Phillips #2 screwdriver", "digital multimeter").
- Include any uncommon tools the user may need to buy.

Additional:
- Always estimate time and cost realistically for a beginner.
- Do NOT generate parts or videos (leave arrays empty).

Schema to follow exactly:

{
  "overview": string,
  "diagnostic_steps": string[],
  "repair_steps": string[],
  "tools_needed": string[],
  "time_estimate": string,
  "cost_estimate": string,
  "parts": [],
  "videos": []
}
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(\`Groq error: \${response.status} \${(await response.text())}\`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "{}";
}

/** Coerce any text to JSON object safely */
export function coerceToJSONObject(text: string): any {
  const raw = text.trim();
  try {
    return JSON.parse(raw);
  } catch {}
  const m = raw.match(/([\[{][\s\S]*[\]}])/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  return { message: raw };
}

/** Normalize AI output into expected schema safely */
export function normalizeToSchema(obj: any): NormalizedData {
  return {
    overview:
      typeof obj?.overview === "string"
        ? obj.overview
        : typeof obj?.summary === "string"
        ? obj.summary
        : typeof obj?.message === "string"
        ? obj.message
        : "No overview available",

    diagnostic_steps: Array.isArray(obj?.diagnostic_steps)
      ? obj.diagnostic_steps.map(String)
      : [],

    repair_steps: Array.isArray(obj?.repair_steps)
      ? obj.repair_steps.map(String)
      : [],

    tools_needed: Array.isArray(obj?.tools_needed)
      ? obj.tools_needed.map(String)
      : [],

    time_estimate:
      typeof obj?.time_estimate === "string"
        ? obj.time_estimate
        : "N/A",

    cost_estimate:
      typeof obj?.cost_estimate === "string"
        ? obj.cost_estimate
        : "N/A",

    // Always empty; handled in /api/diagnose
    parts: [],
    videos: [],
  };
}
