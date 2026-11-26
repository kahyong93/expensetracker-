'use server';

import * as categoriesData from '@/data/categories';
import type { ActionResult, EntryType } from '@/lib/types';
import { parseCategoryName, parseEntryType, parseMonthLabel } from '@/lib/validation';
import { INVALID, runAction } from './run-action';

export async function addCategoryAction(
  monthKey: string,
  type: EntryType,
  name: string,
): Promise<ActionResult<{ created: boolean }>> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const t = parseEntryType(type);
    const n = parseCategoryName(name);
    if (!key || !t || !n) return INVALID;
    return categoriesData.addCategory(key, t, n);
  });
}

export async function renameCategoryAction(
  monthKey: string,
  type: EntryType,
  oldName: string,
  newName: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const t = parseEntryType(type);
    const from = parseCategoryName(oldName);
    const to = parseCategoryName(newName);
    if (!key || !t || !from || !to) return INVALID;
    return categoriesData.renameCategory(key, t, from, to);
  });
}

export async function deleteCategoryAction(monthKey: string, type: EntryType, name: string): Promise<ActionResult> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const t = parseEntryType(type);
    const n = parseCategoryName(name);
    if (!key || !t || !n) return INVALID;
    return categoriesData.deleteCategory(key, t, n);
  });
}
