'use server';

import * as settingsData from '@/data/settings';
import type { CurrencyCode } from '@/lib/money';
import type { ActionResult, LayoutPref, Settings } from '@/lib/types';
import { parseCurrencyCode, parseLayout, parseRate, parseSettingsPatch } from '@/lib/validation';
import { INVALID, done, runAction } from './run-action';

export async function setCurrencyAction(code: CurrencyCode): Promise<ActionResult> {
  return runAction(async () => {
    const currency = parseCurrencyCode(code);
    if (!currency) return INVALID;
    await settingsData.updateSettings({ currency });
    return done;
  });
}

export async function setRateAction(code: CurrencyCode, rate: number): Promise<ActionResult> {
  return runAction(async () => {
    const currency = parseCurrencyCode(code);
    const value = parseRate(rate);
    if (!currency || currency === 'SGD' || value == null) return INVALID;
    await settingsData.setCurrencyRate(currency, value);
    return done;
  });
}

export async function setLayoutAction(layout: LayoutPref): Promise<ActionResult> {
  return runAction(async () => {
    const value = parseLayout(layout);
    if (!value) return INVALID;
    await settingsData.updateSettings({ layout: value });
    return done;
  });
}

/** Settings modal (PRD §7.8 S3–S5). */
export async function updateSettingsAction(patch: Partial<Settings>): Promise<ActionResult> {
  return runAction(async () => {
    const value = parseSettingsPatch(patch);
    if (!value) return INVALID;
    await settingsData.updateSettings(value);
    return done;
  });
}
