import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import indexJson from "@/data/quant-forge-index.json";
import { buildSystemPrompt, sourceEvent, sseEvent, validateChatRequest } from "@/lib/chat";
import { retrieve, toCitations } from "@/lib/retrieval";
import type { QuantForgeIndex } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const index = indexJson as QuantForgeIndex;
const encoder = new TextEncoder();

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "The chat request must contain valid JSON." }, { status: 400 });
  }

  const parsed = validateChatRequest(payload);
  if (!parsed) return Response.json({ error: "The chat request has an invalid shape." }, { status: 400 });
  const latestUserMessage = [...parsed.messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return Response.json({ error: "A user message is required." }, { status: 400 });

  const retrieval = retrieve(index, [
    latestUserMessage.content,
    ...(parsed.dataset?.columns.map((column) => `${column.name} ${column.type}`) ?? []),
  ].join(" "));
  const sources = toCitations(retrieval);

  if (sources.length === 0) {
    return streamStaticResponse(
      sources,
      "I couldn’t find an indexed QuantForge API that matches this request. This assistant only recommends symbols found in the current QuantForge header index. For a general workflow, first define the financial objective, validate dates and units, and then locate the appropriate pricing, time, or term-structure component in the indexed C++ API.",
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Server configuration is incomplete. Set GEMINI_API_KEY before using chat." },
      { status: 503 },
    );
  }

  const system = buildSystemPrompt(sources, parsed.dataset);
  const prompt = parsed.messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content)
    .join("\n\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(sourceEvent(sources)));
      try {
        const result = streamText({
          model: google("gemini-3.5-flash"),
          system,
          prompt,
          maxOutputTokens: 1_400,
          temperature: 0.1,
        });
        for await (const delta of result.textStream) {
          controller.enqueue(encoder.encode(sseEvent("delta", delta)));
        }
        controller.enqueue(encoder.encode(sseEvent("done", { ok: true })));
      } catch (error) {
        console.error("QuantForge chat stream failed", error);
        controller.enqueue(encoder.encode(sseEvent("error", "The model request failed. Check the API key, quota, and retry.")));
      } finally {
        controller.close();
      }
    },
  });
  return sseResponse(stream);
}

function streamStaticResponse(sources: ReturnType<typeof toCitations>, message: string) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sourceEvent(sources)));
      controller.enqueue(encoder.encode(sseEvent("delta", message)));
      controller.enqueue(encoder.encode(sseEvent("done", { ok: true })));
      controller.close();
    },
  });
  return sseResponse(stream);
}

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
