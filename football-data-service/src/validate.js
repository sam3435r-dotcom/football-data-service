"use strict";

/**
 * Query-parameter validation & sanitisation.
 * Everything that reaches a provider is passed through here first.
 */

/** Strip control chars, collapse whitespace, trim, and hard-limit length. */
function cleanString(value, maxLen = 80) {
  if (value === undefined || value === null) return "";
  let s = String(value);
  // remove control characters (incl. newlines / null bytes)
  s = s.replace(/[\u0000-\u001F\u007F]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Competition code: uppercase letters/digits only, max 8 chars. */
function cleanCompetition(value) {
  const s = cleanString(value, 16).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.slice(0, 8);
}

/** ISO date YYYY-MM-DD, or "" if invalid. */
function cleanDate(value) {
  const s = cleanString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? "" : s;
}

/** Season year: integer within a sane range, or the fallback. */
function cleanSeason(value, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < 1990 || n > 2100) return fallback;
  return n;
}

/** Clamp an integer into [min, max]. */
function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Today's date (UTC) as YYYY-MM-DD. */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/** Basic e-mail-free, length-limited identifier for logs/keys. */
function safeKey(value, maxLen = 64) {
  return cleanString(value, maxLen).replace(/[^A-Za-z0-9:._-]/g, "");
}

module.exports = {
  cleanString,
  cleanCompetition,
  cleanDate,
  cleanSeason,
  clampInt,
  todayUTC,
  safeKey,
};
