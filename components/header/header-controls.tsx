"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEntryModal } from "@/components/entry/entry-modal-provider";
import { AccountButton } from "@/components/header/account-button";
import { CreateMonthModal } from "@/components/header/create-month-modal";
import { LayoutToggle } from "@/components/header/layout-toggle";
import { SettingsModal } from "@/components/header/settings-modal";
import { GearIcon } from "@/components/icons/line-icons";
import { useCashflowData, useDisplayCurrency, useMutate } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, currencyLabel, isCurrencyCode, type CurrencyCode } from "@/lib/money";
import { monthHref, tabFromPathname } from "@/lib/months";
import { setCurrencyAction, setRateAction } from "@/server/actions/settings";

/** Header controls (DESIGN_SYSTEM §7.11.3, PRD G3–G7). */
export function HeaderControls() {
  const { app, monthKey } = useCashflowData();
  const currency = useDisplayCurrency();
  const mutate = useMutate();
  const { isPhone } = useLayoutMode();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { openAdd } = useEntryModal();
  const [monthModal, setMonthModal] = useState(0);
  const [settingsModal, setSettingsModal] = useState(0);
  const [rateDraft, setRateDraft] = useState<{ code: string; value: string } | null>(null);

  const tab = tabFromPathname(pathname);
  const monthKeys = app.monthKeys.includes(monthKey) ? app.monthKeys : [...app.monthKeys, monthKey];
  const rateValue = rateDraft && rateDraft.code === currency.code ? rateDraft.value : String(currency.rate);

  const switchMonth = (key: string) => {
    router.push(monthHref(key, tab));
    toast(`Switched to ${key}`);
  };

  const changeCurrency = async (code: CurrencyCode) => {
    const res = await mutate({ kind: "setCurrency", code }, () => setCurrencyAction(code));
    if (!res.ok) toast(res.message);
  };

  // Saved on blur (and Enter) rather than per keystroke; the draft shows meanwhile.
  const commitRate = async () => {
    if (!rateDraft || rateDraft.code !== currency.code) return;
    const value = Number(rateDraft.value);
    const code = currency.code;
    if (!Number.isFinite(value) || value <= 0 || value === currency.rate) {
      setRateDraft(null);
      return;
    }
    const pending = mutate({ kind: "setRate", code, rate: value }, () => setRateAction(code, value));
    setRateDraft(null);
    const res = await pending;
    if (!res.ok) toast(res.message);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LayoutToggle />
      <PillSelect aria-label="Month" value={monthKey} onChange={(e) => switchMonth(e.target.value)}>
        {monthKeys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </PillSelect>
      <Button variant="outline" size="md" onClick={() => setMonthModal((n) => n + 1)} disabled={!monthKey}>
        + Month
      </Button>
      <PillSelect
        aria-label="Currency"
        value={currency.code}
        onChange={(e) => {
          if (isCurrencyCode(e.target.value)) void changeCurrency(e.target.value);
        }}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {currencyLabel(c)}
          </option>
        ))}
      </PillSelect>
      {currency.code !== "SGD" ? (
        <label className="flex items-center gap-1.5 text-xs text-cf-ink-muted">
          S$1 =
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            aria-label={`Rate: ${currency.code} per S$1`}
            value={rateValue}
            onChange={(e) => setRateDraft({ code: currency.code, value: e.target.value })}
            onBlur={() => void commitRate()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRate();
            }}
            className="w-[70px] rounded-cf-input-sm border-[1.5px] border-cf-line-strong bg-cf-surface px-2 py-[7px] text-[13px] font-bold text-cf-ink"
          />
          {currency.sym}
        </label>
      ) : null}
      <Button
        variant="outline"
        size="md"
        aria-label="Settings"
        title="Settings"
        className={isPhone ? "min-h-11 min-w-11" : undefined}
        onClick={() => setSettingsModal((n) => n + 1)}
      >
        <GearIcon />
      </Button>
      {isPhone ? null : (
        <Button
          variant="primary"
          size="lg"
          disabled={!monthKey}
          onClick={() => openAdd({ type: tab === "income" ? "In" : "Out" })}
        >
          + Add item
        </Button>
      )}
      <AccountButton />
      {settingsModal > 0 ? (
        <SettingsModal key={settingsModal} open onClose={() => setSettingsModal(0)} />
      ) : null}
      {monthModal > 0 && monthKey ? (
        <CreateMonthModal key={monthModal} open activeKey={monthKey} onClose={() => setMonthModal(0)} />
      ) : null}
    </div>
  );
}
