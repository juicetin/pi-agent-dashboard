/**
 * Family-test barrel — imports every family file for its registration
 * side-effects so `cube.test.ts` can sweep a fully-populated
 * REGISTERED_SCENARIOS map.
 *
 * Each family file registers at module top-level via `register(cell, tag)`.
 * When a new family file is added, import it here.
 */
import "./a-electron.test.js";
