import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, normalizePreferences } from "../src/domain/preferences.js";

const preferences = normalizePreferences(null);

assert.equal(preferences.density, DEFAULT_PREFERENCES.density);
assert.equal(preferences.density, "comfortable");
assert.equal(normalizePreferences({ density: "compact" }).density, "compact");

console.log("null preference normalization test passed");
