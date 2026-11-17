import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Wander Passport AI: "where is this photo?", memory sorting, small drafting jobs.
// Uses the free Gemini key (GEMINI_API_KEY) if set, else ANTHROPIC_API_KEY. With neither, replies 503
// so the app falls back to its starter content.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function extractJSON(text: string) {
  const s = text.indexOf("{"), a = text.indexOf("[");
  const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return JSON.parse(text.slice(start, end + 1));
}
async function askAI(prompt: string, images: { media_type: string; data: string }[] = []) {
  const gkey = Deno.env.get("GEMINI_API_KEY");
  if (gkey) {
    const models = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"].filter(Boolean) as string[];
    const parts: unknown[] = images.map((i) => ({ inline_data: { mime_type: i.media_type, data: i.data } }));
    parts.push({ text: prompt + "\n\nReply with JSON only, no prose and no code fences." });
    let last = "";
    for (const m of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
      });
      if (r.status === 404 || r.status === 429 || r.status === 503 || r.status === 500) { last = `${m}: ${r.status}`; continue; }
      if (!r.ok) throw { code: "upstream", status: r.status, detail: (await r.text()).slice(0, 300) };
      const d = await r.json();
      const text = (d.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      try { return extractJSON(text); } catch { last = `${m}: parse`; continue; }
    }
    throw { code: last.includes("429") ? "rate_limited" : "upstream", detail: last };
  }
  const akey = Deno.env.get("ANTHROPIC_API_KEY");
  if (akey) {
    const content: unknown[] = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));
    content.push({ type: "text", text: prompt + "\n\nReply with JSON only, no prose and no code fences." });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": akey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 6000, messages: [{ role: "user", content }] }),
    });
    if (r.status === 429) throw { code: "rate_limited" };
    if (!r.ok) throw { code: "upstream", status: r.status };
    const d = await r.json();
    return extractJSON((d.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join(""));
  }
  throw { code: "not_granted" };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: { prompt?: string; images?: { media_type: string; data: string }[] };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const prompt = String(body.prompt || "").slice(0, 12000);
  if (!prompt) return json({ error: "prompt required" }, 400);
  const images = (body.images || []).slice(0, 4).filter((i) => i && i.data && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type));
  try { return json({ result: await askAI(prompt, images) }); }
  catch (e) {
    const err = e as { code?: string; detail?: string };
    if (err?.code === "not_granted") return json({ code: "not_granted", error: "AI is not configured yet" }, 503);
    if (err?.code === "rate_limited") return json({ code: "rate_limited" }, 429);
    return json({ code: err?.code || "error", detail: String(err?.detail || e).slice(0, 300) }, 502);
  }
});
