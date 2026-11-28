import 'server-only';
import { db } from '@/db';
import { currencyRates, users } from '@/db/schema';
import { CARRY_DEFAULT, SPLIT_DEFAULT } from '@/lib/plan';
import type { CurrencyCode } from '@/lib/money';
import type { AppData, LayoutPref, PlanPrefs } from '@/lib/types';
import { requireUserId } from './auth';
import { ensureUserRow } from './scope';

const DEFAULTS = {
  currency: 'SGD',
  layout: 'auto',
  settings: { autoCategorise: true, compactCards: false, showAudit: true },
  planPrefs: { split: SPLIT_DEFAULT, carryMode: CARRY_DEFAULT },
} as const satisfies Omit<AppData, 'monthKeys' | 'rates'>;

/** Settings, rate overrides and month list for the signed-in user. */
export async function getAppData(): Promise<AppData> {
  const userId = await requireUserId();
  const [user, rates, monthRows] = await Promise.all([
    db.query.users.findFirst({
      where: { id: userId },
      columns: {
        currency: true,
        layout: true,
        autoCategorise: true,
        compactCards: true,
        showAudit: true,
        splitNeeds: true,
        splitInvest: true,
        splitFun: true,
        carryMode: true,
      },
    }),
    db.query.currencyRates.findMany({ where: { userId }, columns: { code: true, rate: true } }),
    db.query.months.findMany({
      where: { userId },
      columns: { key: true },
      orderBy: { sortIndex: 'asc', createdAt: 'asc' },
    }),
  ]);

  const rateMap: AppData['rates'] = {};
  for (const r of rates) rateMap[r.code] = r.rate;

  return {
    monthKeys: monthRows.map((m) => m.key),
    currency: user?.currency ?? DEFAULTS.currency,
    rates: rateMap,
    layout: user?.layout ?? DEFAULTS.layout,
    settings: user
      ? { autoCategorise: user.autoCategorise, compactCards: user.compactCards, showAudit: user.showAudit }
      : { ...DEFAULTS.settings },
    planPrefs: user
      ? { split: { needs: user.splitNeeds, invest: user.splitInvest, fun: user.splitFun }, carryMode: user.carryMode }
      : { split: { ...SPLIT_DEFAULT }, carryMode: CARRY_DEFAULT },
  };
}

export type SettingsPatch = Partial<{
  currency: CurrencyCode;
  layout: LayoutPref;
  autoCategorise: boolean;
  compactCards: boolean;
  showAudit: boolean;
  splitNeeds: number;
  splitInvest: number;
  splitFun: number;
  carryMode: 'off' | 'last' | 'cum';
}>;

/** Update the signed-in user's settings, creating their row on first use. */
export async function updateSettings(patch: SettingsPatch): Promise<void> {
  const userId = await requireUserId();
  if (Object.keys(patch).length === 0) return;
  await db
    .insert(users)
    .values({ id: userId, ...patch })
    .onConflictDoUpdate({ target: users.id, set: patch });
}

/** Save the split targets and carry mode (budget page). */
export async function updatePlanPrefs(prefs: PlanPrefs): Promise<void> {
  await updateSettings({
    splitNeeds: prefs.split.needs,
    splitInvest: prefs.split.invest,
    splitFun: prefs.split.fun,
    carryMode: prefs.carryMode,
  });
}

/** Override the rate for a non-SGD currency (units per S$1). */
export async function setCurrencyRate(code: Exclude<CurrencyCode, 'SGD'>, rate: number): Promise<void> {
  const userId = await requireUserId();
  await db.batch([
    ensureUserRow(userId),
    db
      .insert(currencyRates)
      .values({ userId, code, rate })
      .onConflictDoUpdate({ target: [currencyRates.userId, currencyRates.code], set: { rate } }),
  ]);
}
