"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Markdown } from "./markdown";
import type { Citation } from "@/lib/ai/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface ChatPanelProps {
  persona: "officer" | "applicant";
  language?: string;
  analysisId?: string;
  suggestions?: string[];
  placeholder?: string;
  rtl?: boolean;
  intro?: string;
  /** Reset the thread when this key changes (e.g. language switch). */
  resetKey?: string;
}

export function ChatPanel({
  persona,
  language = "en",
  analysisId,
  suggestions = [],
  placeholder = "Ask a question…",
  rtl = false,
  intro,
  resetKey,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationAccessKey, setConversationAccessKey] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation when the reset key changes.
  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
    setConversationAccessKey(undefined);
    setError(null);
  }, [resetKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          conversationAccessKey,
          message,
          persona,
          language,
          analysisId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The assistant could not respond.");
      setConversationId(data.conversationId);
      if (data.conversationAccessKey) {
        setConversationAccessKey(data.conversationAccessKey);
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full border border-govuk-mid-grey bg-white">
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[280px] max-h-[460px]"
      >
        {messages.length === 0 && (
          <div className="text-govuk-dark-grey">
            {intro && <p className="mb-4">{intro}</p>}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-govuk-black">Try asking:</p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    dir={rtl ? "rtl" : "ltr"}
                    className="block w-full text-left p-3 border border-govuk-mid-grey hover:border-govuk-blue hover:bg-govuk-light-grey text-sm text-govuk-blue"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "bg-govuk-blue text-white p-3 max-w-[85%]"
                  : "bg-govuk-light-grey p-3 max-w-[92%] w-full"
              }
            >
              {m.role === "assistant" ? (
                <>
                  <div className="flex items-center gap-2 mb-1 text-govuk-dark-grey text-xs font-bold uppercase">
                    <Sparkles className="h-3.5 w-3.5" /> Assistant
                  </div>
                  <Markdown content={m.content} dir={rtl ? "rtl" : "ltr"} />
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-govuk-mid-grey">
                      <p className="text-xs font-bold text-govuk-dark-grey mb-1">
                        Based on policy:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {m.citations.map((c) => (
                          <span
                            key={`${c.regime ?? "policy"}:${c.ref}`}
                            className="text-xs bg-white border border-govuk-mid-grey px-2 py-0.5"
                            title={c.policyTitle ?? c.heading}
                          >
                            {c.policyTitle ? `${c.policyTitle}: ` : ""}
                            {c.ref} {c.heading}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p dir={rtl ? "rtl" : "ltr"} className="whitespace-pre-wrap">
                  {m.content}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-govuk-light-grey p-3 flex items-center gap-2 text-govuk-dark-grey">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-[#fef7f7] border-t border-govuk-red text-govuk-red text-sm">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-govuk-mid-grey p-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          dir={rtl ? "rtl" : "ltr"}
          disabled={loading}
          className="govuk-input flex-1 border-2"
          aria-label="Your message"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="govuk-button whitespace-nowrap"
        >
          <Send className="h-4 w-4 mr-1" /> Send
        </button>
      </form>
    </div>
  );
}
