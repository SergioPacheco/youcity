#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequestGuard } from "../src/core/async-guard.mjs";

const guard = createRequestGuard();
const first = guard.next();
const second = guard.next();
assert.notEqual(first, second);
assert.equal(guard.isCurrent(first), false);
assert.equal(guard.isCurrent(second), true);

const cachedRequest = guard.next();
guard.next();
assert.equal(guard.isCurrent(cachedRequest), false, "navigation must invalidate requests even when the next result is cached");

console.log("Async guard tests passed.");
