/* ==========================================================================
   Credentials — tracking references, access codes and code hashing.
   Codes come from the Web Crypto CSPRNG and use an alphabet with no
   look-alike characters (no 0/O, 1/I/L). Access codes are only ever
   persisted as SHA-256 hashes, mirroring how a real backend should treat
   them (a production system would use a slow KDF such as Argon2id server-side).
   ========================================================================== */
(function () {
  'use strict';

  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function randomChars(n) {
    const out = [];
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) out.push(ALPHABET[buf[i] % ALPHABET.length]);
    return out.join('');
  }

  /** e.g. "CL-7K4M-Q2XD" */
  const newReference = () => `CL-${randomChars(4)}-${randomChars(4)}`;
  /** e.g. "H8RT-2MXQ-PZ4N" */
  const newAccessCode = () => `${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;

  /** Normalise user input so "cl 7k4m q2xd" and "CL-7K4M-Q2XD" match. */
  function normalize(value, groups) {
    const clean = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!groups) return clean;
    const parts = [];
    let i = 0;
    for (const g of groups) { if (i >= clean.length) break; parts.push(clean.slice(i, i + g)); i += g; }
    return parts.join('-');
  }
  const normalizeReference = (v) => normalize(v, [2, 4, 4]);
  const normalizeAccessCode = (v) => normalize(v, [4, 4, 4]);

  async function hash(value) {
    const text = `clearline:v1:${normalize(value)}`;
    if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) { /* fall through */ }
    }
    // Non-cryptographic fallback for insecure contexts (demo only).
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv1a:' + (h >>> 0).toString(16);
  }

  /** Constant-time-ish comparison of two hash strings. */
  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  window.SU.crypto = { newReference, newAccessCode, normalizeReference, normalizeAccessCode, hash, safeEqual };
})();
