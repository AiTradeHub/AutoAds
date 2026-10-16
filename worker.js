const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const requestBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = requestBuckets.get(ip);
  if (!entry || now - entry.startedAt >= 60000) { requestBuckets.set(ip, { startedAt: now, count: 1 }); return false; }
  entry.count += 1;
  return entry.count > 12;
}
function json(data, status = 200) { return new Response(JSON.stringify(data), { status: status, headers: JSON_HEADERS }); }
function clean(value, max = 800) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function parseModelOutput(output) {
  if (typeof output === "string") {
    const trimmed = output.replace(/^\s*[\x60]{3}(?:json)?\s*/i, "").replace(/\s*[\x60]{3}\s*$/, "").trim();
    try { return JSON.parse(trimmed); } catch (error) { return null; }
  }
  if (output && typeof output === "object") return output;
  return null;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, aiAvailable: Boolean(env.AI), service: "autoads" });
    if (url.pathname !== "/api/generate") return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) return json({ error: "Ai atins limita temporară. Încearcă din nou peste un minut." }, 429);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8192) return json({ error: "Cererea este prea mare." }, 413);
    if (!env.AI || typeof env.AI.run !== "function") return json({ error: "AI-ul nu este configurat în Cloudflare." }, 503);
    let input;
    try { input = await request.json(); } catch (error) { return json({ error: "Cererea trebuie să conțină JSON valid." }, 400); }
    const business = clean(input.business, 120);
    const product = clean(input.product, 220);
    const details = clean(input.details, 1000);
    const tone = ["friendly", "premium", "direct", "playful"].includes(input.tone) ? input.tone : "friendly";
    const goal = ["messages", "sales", "visits", "awareness"].includes(input.goal) ? input.goal : "messages";
    if (!business || !product) return json({ error: "Completează afacerea și produsul/serviciul." }, 400);
    const prompt = [
      "Ești un copywriter de reclame pentru afaceri mici din România.",
      "Scrie exclusiv în limba română, natural, specific și fără clișee.",
      "Nu inventa prețuri, reduceri, rezultate, garanții, disponibilitate sau afirmații despre produs.",
      "Folosește doar informațiile furnizate. Dacă lipsesc detalii, nu le inventa.",
      "Răspunde doar cu un obiect JSON valid cu exact două câmpuri string: title (titlu scurt, maximum 70 caractere) și caption (text publicitar de 2-5 propoziții și maximum 700 caractere, CTA potrivit și maximum 5 hashtaguri relevante). Fără markdown.",
      "Afacere: " + business,
      "Produs/serviciu: " + product,
      "Detalii confirmate: " + (details || "Nu au fost furnizate."),
      "Ton: " + tone,
      "Obiectiv: " + goal
    ].join("\n");
    try {
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [
          { role: "system", content: "Urmează strict instrucțiunile și returnează JSON valid, fără text în afara JSON-ului." },
          { role: "user", content: prompt }
        ],
        max_tokens: 450,
        temperature: 0.65
      });
      let modelOutput = result && (result.response || result.output_text);
      if (!modelOutput) modelOutput = result;
      const parsed = parseModelOutput(modelOutput);
      const title = clean(parsed && parsed.title, 100);
      const caption = clean(parsed && parsed.caption, 900);
      if (!title || !caption) return json({ error: "Modelul nu a returnat un text publicitar valid." }, 502);
      return json({ title: title, caption: caption, source: "cloudflare-ai" });
    } catch (error) {
      return json({ error: "Generarea AI a eșuat. Încearcă din nou sau folosește generarea locală." }, 502);
    }
  }
};
