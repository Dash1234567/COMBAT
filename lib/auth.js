'use strict';

// Authentication helpers built on Node's built-in crypto (no dependencies).
// Passwords use scrypt with a per-user salt; sessions use random tokens.

const crypto = require('node:crypto');

const KEY_LEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  let computed;
  try {
    computed = crypto.scryptSync(password, salt, KEY_LEN);
  } catch {
    return false;
  }
  const stored = Buffer.from(hash, 'hex');
  // timingSafeEqual requires equal-length buffers.
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

module.exports = { hashPassword, verifyPassword, newToken, parseCookies };
