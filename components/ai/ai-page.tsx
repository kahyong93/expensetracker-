"use client";

import { AskMoneyChat } from "@/components/ai/ask-money-chat";
import { InsightCards } from "@/components/ai/insight-cards";
import { PasteToAdd } from "@/components/ai/paste-to-add";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { MonthMissing } from "@/components/shell/month-missing";

/**
 * AI helper tab (PRD §7.7 AI-2, AI-3, AI-5, AI-6, AI-7): three insight cards, then
 * "Ask your money" and "Paste to add" side by side (stacked below 2 × 420px).
 */
export function AiPage() {
  const view = useMonthView();

  if (view.status === "missing") return <MonthMissing monthKey={view.monthKey} tab="ai" />;

  const { monthKey, insights, currency } = view;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">AI helper for {monthKey}</h1>
      <InsightCards monthKey={monthKey} insights={insights} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
        <AskMoneyChat key={`chat-${monthKey}`} monthKey={monthKey} currency={currency} />
        <PasteToAdd key={`paste-${monthKey}`} monthKey={monthKey} currency={currency} />
      </div>
    </div>
  );
}
