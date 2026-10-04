"use client";

import { FormEvent, useMemo, useState } from "react";
import { DatasetPicker } from "@/components/dataset-picker";
import { MarkdownMessage } from "@/components/markdown-message";
import type { ChatMessage, DatasetMetadata, SourceCitation } from "@/lib/types";

interface DisplayMessage extends ChatMessage {
  id: string;
  sources?: SourceCitation[];
}

const SUGGESTIONS = [
  "Which function should I use for option pricing?",
  "Inspect my CSV columns and suggest a QuantForge workflow.",
  "Does QuantForge support GARCH volatility models?",
  "Show a C++ example using Date and DayCounter.",
];

export function ChatAssistant() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [dataset, setDataset] = useState<DatasetMetadata>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const empty = messages.length === 0;

  const requestMessages = useMemo<ChatMessage[]>(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  );

  async function send(text = input) {
    const content = text.trim();
    if (!content || isLoading) return;
    setInput("");
    setError(undefined);
    setIsLoading(true);
    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...requestMessages, { role: "user", content }], dataset }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "The assistant is unavailable right now.");
      }
      await consumeStream(response.body, (event, data) => {
        if (event === "sources") {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, sources: data as SourceCitation[] }
            : message));
        }
        if (event === "delta") {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: message.content + String(data) }
            : message));
        }
        if (event === "error") setError(String(data));
      });
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError(requestError instanceof Error ? requestError.message : "The assistant is unavailable right now.");
    } finally {
      setIsLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">QuantForge <span className="text-cyan-300">AI Assistant</span></p>
            <p className="mt-1 text-sm text-slate-400">Source-grounded C++ guidance for the QuantForge codebase.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={empty || isLoading}
            onClick={() => { setMessages([]); setError(undefined); }}
          >
            Clear chat
          </button>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col justify-center py-10 sm:py-16">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">Indexed API guidance · no code execution</p>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Find the right QuantForge building blocks.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Ask about available C++ classes, functions, workflows, or a small CSV schema. Each recommendation is accompanied by its indexed source location.</p>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left text-sm text-slate-300 transition hover:border-cyan-400/45 hover:bg-slate-900 hover:text-white">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-5 py-4">
              {messages.map((message) => (
                <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[95%]"}>
                  <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">{message.role === "user" ? "You" : "QuantForge AI"}</p>
                  <div className={message.role === "user" ? "rounded-2xl rounded-tr-sm bg-cyan-400 px-4 py-3 text-slate-950" : "rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/80 px-4 py-3 text-slate-200"}>
                    {message.content ? <MarkdownMessage>{message.content}</MarkdownMessage> : <span className="inline-flex gap-1 text-slate-400"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Indexed sources</p>
                      <ul className="mt-2 space-y-1">
                        {message.sources.map((source) => <li key={source.id} className="font-mono text-xs text-cyan-200"><span className="text-slate-400">{source.file}:{source.line}</span> · {source.name}</li>)}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="sticky bottom-0 pt-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl shadow-black/30">
            <DatasetPicker dataset={dataset} onDataset={setDataset} />
            <form className="mt-2 flex gap-2" onSubmit={submit}>
              <textarea
                value={input}
                rows={2}
                disabled={isLoading}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                placeholder="Ask about a QuantForge C++ API…"
                className="min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
              />
              <button type="submit" disabled={!input.trim() || isLoading} className="self-end rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Send</button>
            </form>
            {error && <p className="px-2 pb-1 text-xs text-rose-300">{error}</p>}
          </div>
          <p className="py-3 text-center text-xs text-slate-600">Guidance only. It never executes code or analyzes raw CSV data.</p>
        </footer>
      </div>
    </main>
  );
}

async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const packets = buffer.split("\n\n");
    buffer = packets.pop() ?? "";
    for (const packet of packets) {
      const event = /^event: (.+)$/m.exec(packet)?.[1];
      const raw = /^data: (.+)$/m.exec(packet)?.[1];
      if (!event || !raw) continue;
      try { onEvent(event, JSON.parse(raw)); } catch { /* ignore malformed stream chunks */ }
    }
  }
}
