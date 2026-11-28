'use server';

import * as entriesData from '@/data/entries';
import type { ActionResult, EntryInput } from '@/lib/types';
import { parseCategoryName, parseEntryInput, parseEntryInputs, parseId, parseLineId, parseMonthLabel } from '@/lib/validation';
import { INVALID, runAction } from './run-action';

/*
 * Entry mutations. Inputs are re-validated here: the client's types are not trusted.
 * Ownership is enforced inside the /data helpers.
 */

export async function addEntryAction(monthKey: string, input: EntryInput): Promise<ActionResult<number>> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const entry = parseEntryInput(input);
    if (!key || !entry) return INVALID;
    return entriesData.addEntries(key, [entry]);
  });
}

export async function addEntriesAction(monthKey: string, inputs: EntryInput[]): Promise<ActionResult<number>> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const list = parseEntryInputs(inputs);
    if (!key || !list) return INVALID;
    return entriesData.addEntries(key, list);
  });
}

export async function updateEntryAction(entryId: string, input: EntryInput): Promise<ActionResult> {
  return runAction(async () => {
    const id = parseId(entryId);
    const entry = parseEntryInput(input);
    if (!id || !entry) return INVALID;
    return entriesData.updateEntry(id, entry);
  });
}

export async function deleteEntryAction(entryId: string): Promise<ActionResult> {
  return runAction(async () => {
    const id = parseId(entryId);
    if (!id) return INVALID;
    return entriesData.deleteEntry(id);
  });
}

/** Expenses board: move an expense to a plan line. */
export async function moveEntryToLineAction(entryId: string, lineId: string): Promise<ActionResult> {
  return runAction(async () => {
    const id = parseId(entryId);
    const line = parseLineId(lineId);
    if (!id || !line) return INVALID;
    return entriesData.moveEntryToLine(id, line);
  });
}

export async function moveEntryAction(entryId: string, categoryName: string): Promise<ActionResult> {
  return runAction(async () => {
    const id = parseId(entryId);
    const category = parseCategoryName(categoryName);
    if (!id || !category) return INVALID;
    return entriesData.moveEntry(id, category);
  });
}
