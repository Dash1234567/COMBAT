'use strict';

// Tiny in-memory rate limiter (no dependencies). Counts "strikes" per key
// within a rolling window and blocks the key once a threshold is reached.
// Suitable for a single-process server; resets if the process restarts.

function createLimiter({ max, windowMs, blockMs }) {
  const hits = new Map(); // key -> { count, windowEnd, blockedUntil }

  // Seconds remaining if the key is currently blocked, else 0.
  function retryAfter(key) {
    const rec = hits.get(key);
    if (rec && rec.blockedUntil > Date.now()) {
      return Math.ceil((rec.blockedUntil - Date.now()) / 1000);
    }
    return 0;
  }

  // Record a strike; blocks the key once `max` strikes occur within the window.
  function strike(key) {
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now > rec.windowEnd) rec = { count: 0, windowEnd: now + windowMs, blockedUntil: 0 };
    rec.count += 1;
    if (rec.count >= max) rec.blockedUntil = now + blockMs;
    hits.set(key, rec);
  }

  function reset(key) { hits.delete(key); }

  // Drop fully-expired records so the map doesn't grow without bound.
  function sweep() {
    const now = Date.now();
    for (const [key, rec] of hits) {
      if (rec.blockedUntil <= now && rec.windowEnd <= now) hits.delete(key);
    }
  }
  const timer = setInterval(sweep, Math.max(windowMs, blockMs));
  if (timer.unref) timer.unref();

  return { retryAfter, strike, reset };
}

module.exports = { createLimiter };
