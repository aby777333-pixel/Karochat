import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Wrapper that prefers the new Responses API and falls back to Chat Completions
 * if the deployed model/account hasn't picked it up yet. Returns the assistant's
 * text content as a string, or throws.
 */
export async function aiText(
  instructions: string,
  input: string,
  opts: { jsonOnly?: boolean } = {}
): Promise<string> {
  const ai = getOpenAI();
  if (!ai) throw new Error("OPENAI_API_KEY not set");

  try {
    const resp = await ai.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input,
      ...(opts.jsonOnly ? { text: { format: { type: "json_object" as const } } } : {})
    } as any);
    const text =
      (resp as any).output_text ??
      (resp as any).output?.[0]?.content?.[0]?.text ??
      "";
    if (text) return text;
    throw new Error("empty responses-api output");
  } catch (err) {
    // Fall back to Chat Completions
    const chat = await ai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input }
      ],
      ...(opts.jsonOnly ? { response_format: { type: "json_object" as const } } : {})
    });
    return chat.choices[0]?.message?.content ?? "";
  }
}
