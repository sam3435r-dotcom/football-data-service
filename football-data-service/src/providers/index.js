"use strict";

/**
 * Provider registry. Adding a new provider later = add one file here.
 * Each provider exposes: id, label, isEnabled(), supports{}, and methods.
 */

const footballData = require("./footballDataOrg");
const apiFootball = require("./apiFootball");

const PROVIDERS = [apiFootball, footballData];

/** All providers, in priority order. */
function all() {
  return PROVIDERS;
}

/** Only providers that have a key configured. */
function enabled() {
  return PROVIDERS.filter((p) => p.isEnabled());
}

/**
 * Providers that can serve a given capability, enabled ones first.
 * Used by the core dispatcher to try the best provider then fall back.
 */
function forCapability(capability) {
  const enabledFirst = [...PROVIDERS].sort(
    (a, b) => Number(b.isEnabled()) - Number(a.isEnabled())
  );
  return enabledFirst.filter((p) => p.supports && p.supports[capability]);
}

function describe() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    enabled: p.isEnabled(),
    supports: p.supports,
  }));
}

module.exports = { all, enabled, forCapability, describe };
