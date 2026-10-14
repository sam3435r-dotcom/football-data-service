"use strict";

/**
 * Thin fetch wrapper: JSON parsing, timeout via AbortController, and
 * never-throwing behaviour (returns a structured result instead of a stack).
 */

const config = require("./config");

async function fetchJson(url, { headers = {}, timeoutMs } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs || config.requestTimeoutMs
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null; // non-JSON body (e.g. HTML error page)
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      // upstream rate-limit hints, when present
      rateLimit: {
        limit: res.headers.get("x-ratelimit-requests-limit") || res.headers.get("x-ratelimit-limit"),
        remaining: res.headers.get("x-ratelimit-requests-remaining") || res.headers.get("x-ratelimit-remaining"),
      },
    };
  } catch (err) {
    const aborted = err && (err.name === "AbortError" || err.code === "ABORT_ERR");
    return {
      ok: false,
      status: aborted ? 504 : 502,
      data: null,
      error: aborted ? "Upstream request timed out" : "Upstream request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchJson };
