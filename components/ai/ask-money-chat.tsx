"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AI_BAD_REPLY_MESSAGE, AI_BUSY_MESSAGE, askMoney } from "@/lib/mock/ai";
import type { DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type ChatMessage = { id: number; role: "user" | "assistant"; content: string };

type AskMoneyChatProps = {
  monthKey: string;
  currency: DisplayCurrency;
};

function suggestionsFor(sym: string): string[] {
  return [
    "How much did I spend on Uniqlo?",
    `Can I afford a ${sym}300 trip next month?`,
    "What was my biggest expense?",
    "How much did food cost per day?",
  ];
}

const BUBBLE = "max-w-[85%] rounded-cf-bubble px-3.5 py-2.5 text-sm leading-[1.45] whitespace-pre-wrap";

/**
 * "Ask your money" chat (PRD AI-2, DESIGN_SYSTEM §7.7). History lives in component state
 * only (session-only, never persisted). Enter sends; "Clear" resets.
 */
export function AskMoneyChat({ monthKey, currency }: AskMoneyChatProps) {
  const toast = useToast();
  const { isPhone } = useLayoutMode();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  /** Bumped by Clear so a reply that lands afterwards is dropped. */
  const generation = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text?: string) {
    const question = (text ?? draft).trim();
    if (!question || busy) return;
    const gen = generation.current;
    const userId = nextId.current++;
    setMessages((prev) => [...prev, { id: userId, role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    let reply: string | null = null;
    let error: string | null = null;
    try {
      const result = await askMoney({ question, monthKey, sym: currency.sym });
      if (result.ok) reply = result.data.trim();
      else error = result.message;
    } catch {
      error = AI_BUSY_MESSAGE;
    }
    // Cleared while waiting: drop the reply and leave the new conversation alone.
    if (gen !== generation.current) return;
    setBusy(false);
    if (reply) {
      const replyId = nextId.current++;
      const content = reply;
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", content }]);
    } else {
      toast(error ?? AI_BAD_REPLY_MESSAGE);
    }
  }

  function clear() {
    generation.current += 1;
    setMessages([]);
    setBusy(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const hasMessages = messages.length > 0;
  const showSuggestions = !hasMessages && !busy;

  return (
    <Card padding="ai" gap="sm" aria-labelledby={titleId}>
      <CardHeader>
        <SectionTitle id={titleId}>Ask your money</SectionTitle>
        {hasMessages ? (
          <Button variant="ghost" size="sm" onClick={clear} className={cn(isPhone && "min-h-11")}>
            Clear
          </Button>
        ) : null}
      </CardHeader>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-labelledby={titleId}
        tabIndex={hasMessages ? 0 : undefined}
        className="flex max-h-[360px] min-h-[150px] flex-col gap-2 overflow-y-auto px-0.5 py-1"
      >
        {showSuggestions ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[13px] text-cf-ink-muted">Ask anything about {monthKey}. Try one of these:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestionsFor(currency.sym).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className={cn(
                    "rounded-cf-pill border-[1.5px] border-cf-line bg-cf-field px-[11px] py-1.5 text-left text-xs font-bold text-cf-ink",
                    "transition-[border-color] duration-120 ease-out hover:border-cf-sparkle",
                    isPhone && "min-h-11",
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className={cn(BUBBLE, "self-end bg-cf-primary text-white")}>
              <span className="sr-only">You: </span>
              {message.content}
            </div>
          ) : (
            <div key={message.id} className={cn(BUBBLE, "self-start bg-cf-track text-cf-ink")}>
              <span className="sr-only">AI helper: </span>
              {message.content}
            </div>
          ),
        )}

        {busy ? <div className={cn(BUBBLE, "self-start bg-cf-track text-cf-ink-muted")}>Thinking…</div> : null}
      </div>

      <div className="flex gap-2">
        <Input
          aria-labelledby={titleId}
          placeholder={`e.g. Can I afford a ${currency.sym}300 trip next month?`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
          autoComplete="off"
          className="flex-1"
        />
        <Button variant="primary" size="lg" onClick={() => void send()} disabled={busy} className={cn(isPhone && "min-h-11")}>
          Ask
        </Button>
      </div>
    </Card>
  );
}
