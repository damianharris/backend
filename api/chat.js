import { OpenAI } from "openai";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const { prompt } = await req.json();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response("Missing OPENAI_API_KEY", { status: 500 });

  const client = new OpenAI({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const r = await client.responses.create({
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: "You are the 90‑Day Role Transition Agent. Guide users through the first 90 days in a new role with a structured plan, milestones, stakeholder mapping, and quick wins." },
            { role: "user", content: prompt }
          ],
          stream: true
        });

        for await (const event of r) {
          if (event.type === "response.output_text.delta") {
            const payload = JSON.stringify({ delta: event.delta });
            controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
          }
          if (event.type === "response.completed") {
            controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          }
        }
      } catch (err) {
        const payload = JSON.stringify({ error: err.message || String(err) });
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
