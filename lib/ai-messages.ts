/**
 * AI copy and limits shared by the AI Server Actions and the UI (PRD §7.7). Lives outside
 * lib/ai/ because those files are server-only.
 */
export const AI_BUSY_MESSAGE = "AI is busy, try again in a moment";
export const AI_BAD_REPLY_MESSAGE = "Couldn't read the AI reply, try again";
export const PASTE_MAX_CHARS = 4000;
export const PASTE_TOO_LONG_MESSAGE = `Paste up to ${PASTE_MAX_CHARS.toLocaleString("en-US")} characters`;
export const PASTE_EMPTY_MESSAGE = "Paste some text first";
export const PASTE_NO_ENTRIES_MESSAGE = "No entries found in that text";
