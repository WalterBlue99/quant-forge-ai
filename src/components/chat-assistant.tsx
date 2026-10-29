"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { MarkdownMessage } from "@/components/markdown-message";
import type { ChatMessage, SourceCitation } from "@/lib/types";

interface DisplayMessage extends ChatMessage {
  id: string;
  sources?: SourceCitation[];
}

interface FAQItem {
  id: string;
  category: string;
  question: string;
  description: string;
}

const FAQ_QUESTIONS: FAQItem[] = [
  {
    id: "black-scholes",
    category: "Options & Derivatives",
    question: "Which function is useful for Black-Scholes option pricing?",
    description: "Inspect the closed-form Black formula functions and option pricing interfaces in ql/pricingengines/blackformula.hpp.",
  },
  {
    id: "garch-volatility",
    category: "Volatility Modeling",
    question: "Does QuantForge support GARCH volatility models?",
    description: "Find the Garch11 volatility model declaration and parameter calibration in ql/models/volatility/garch.hpp.",
  },
  {
    id: "date-daycounter",
    category: "Time & Conventions",
    question: "Show a C++ example using Date and DayCounter.",
    description: "Learn how calendar dates, year fractions, and day count conventions are calculated across ql/time.",
  },
  {
    id: "european-option-engine",
    category: "Pricing Engines",
    question: "How do I price European options using EuropeanOption and AnalyticEuropeanEngine?",
    description: "Review instrument instantiation, analytic Black-Scholes pricing engines, and NPV calculation.",
  },
  {
    id: "fixed-rate-bond",
    category: "Fixed Income",
    question: "Which class represents a FixedRateBond in QuantForge?",
    description: "Examine coupon schedules, payment day counters, redemption values, and cash flow evaluation in ql/instruments/bonds.",
  },
  {
    id: "zero-coupon-bond",
    category: "Fixed Income",
    question: "How do I model zero-coupon bonds using ZeroCouponBond?",
    description: "Locate ZeroCouponBond constructor signatures, discount curves, and settlement day parameters.",
  },
  {
    id: "flat-forward",
    category: "Yield Curves",
    question: "How do I construct a flat yield term structure using FlatForward?",
    description: "Understand discount factor generation and constant interest rate term structures in ql/termstructures/yield.",
  },
  {
    id: "heston-model",
    category: "Stochastic Volatility",
    question: "What classes implement the HestonModel for stochastic volatility?",
    description: "Explore the Heston process, mean-reversion parameters, and analytic European Fourier engines.",
  },
  {
    id: "day-counters",
    category: "Time & Conventions",
    question: "Which day counters are available, such as Actual360, ActualActual, and Thirty360?",
    description: "Compare ISDA, ISMA, and AFB day counter implementations and day count conventions in ql/time/daycounters.",
  },
  {
    id: "compounding",
    category: "Interest Rates",
    question: "How do I work with interest rate compounding conventions using Compounding?",
    description: "Review Simple, Compounded, Continuous, and SimpleThenCompounded interest rate compounding rules.",
  },
  {
    id: "cash-flow-base",
    category: "Cash Flows",
    question: "Which base class models financial cash flows in QuantForge (CashFlow)?",
    description: "Inspect the core polymorphic CashFlow hierarchy, payment dates, discounting, and visitor pattern support.",
  },
  {
    id: "implied-vol",
    category: "Implied Volatility",
    question: "How do I calculate implied volatility using blackFormulaImpliedStdDevApproximation?",
    description: "Examine fast Chambers-Nawalkha approximations for Black implied standard deviation and volatility solvers.",
  },
  {
    id: "vanilla-option",
    category: "Options & Derivatives",
    question: "What classes model vanilla equity options (VanillaOption)?",
    description: "Review European, American, and Bermudan payoff structures and exercise models in ql/instruments.",
  },
  {
    id: "vanilla-swap",
    category: "Interest Rate Swaps",
    question: "Which class represents interest rate swap instruments (VanillaSwap)?",
    description: "Explore fixed vs. floating leg cash-flow mechanics, index fixings, and fair rate valuation in ql/instruments/vanillaswap.hpp.",
  },
  {
    id: "date-arithmetic",
    category: "Time & Conventions",
    question: "What methods are available in Date for calendar arithmetic and date calculations?",
    description: "Discover date manipulation methods, business day rolling, month-end calculations, and serial day counts.",
  },
];

export function ChatAssistant() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const empty = messages.length === 0;

  // Close FAQ modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFaqOpen(false);
      }
    }
    if (isFaqOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isFaqOpen]);

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
        body: JSON.stringify({ messages: [...requestMessages, { role: "user", content }] }),
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

  function handleSelectFaq(question: string) {
    setIsFaqOpen(false);
    void send(question);
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">QuantForge <span className="text-cyan-300">AI Assistant</span></p>
            <p className="mt-1 text-sm text-slate-400">Source-grounded C++ guidance for the QuantForge codebase.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-100"
              onClick={() => setIsFaqOpen(true)}
            >
              FAQs
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={empty || isLoading}
              onClick={() => { setMessages([]); setError(undefined); }}
            >
              Clear chat
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col justify-center py-10 sm:py-16">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">Indexed API guidance · no code execution</p>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Find the right QuantForge building blocks.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Ask about available C++ classes, functions, and quantitative workflows. Each recommendation is accompanied by its indexed source location.</p>
              </div>
              <div className="mt-8 flex items-center">
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-cyan-300 shadow-lg shadow-cyan-950/20 transition hover:border-cyan-400 hover:bg-slate-800 hover:text-cyan-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>FAQs</span>
                </button>
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
            <form className="flex gap-2" onSubmit={submit}>
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
          <p className="py-3 text-center text-xs text-slate-600">Guidance only. It never executes code or modifies the repository.</p>
        </footer>
      </div>

      {/* FAQs Window / Modal */}
      {isFaqOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsFaqOpen(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-[#091526] shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-0.5 text-xs font-medium text-cyan-300">
                  Verified QuantForge Code Queries
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Frequently Asked Questions (FAQs)
                </h2>
                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  Click any question to ask QuantForge AI. All questions are 100% grounded in indexed C++ headers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFaqOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close FAQs modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - List of 15 Questions */}
            <div className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
              {FAQ_QUESTIONS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectFaq(item.question)}
                  className="group flex w-full flex-col items-start rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-cyan-400/50 hover:bg-slate-800/90"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="rounded-md border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-300 uppercase">
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-cyan-300 transition flex items-center gap-1">
                      Ask this <span aria-hidden="true">&rarr;</span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-200 group-hover:text-white transition">
                    <span className="text-slate-400 mr-2">{index + 1}.</span>
                    {item.question}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 px-6 py-4">
              <span className="text-xs text-slate-400">
                15 coding &amp; quant finance topics available
              </span>
              <button
                type="button"
                onClick={() => setIsFaqOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
