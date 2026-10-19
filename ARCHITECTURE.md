# Architecture and the path to production

## Current (demo)

```
Views ──► SU.store (async API) ──► localStorage adapter
```

`js/core/store.js` is the only module that touches persistence. Its public methods are async and split into two roles, as a remote API would be:

| Reporter (anonymous) | Admin (authenticated) |
|---|---|
| `submitReport`, `unlock`, `getReporterReport`, `sendReporterMessage`, `lockReporter` | `signIn`, `signOut`, `listReports`, `getReport`, `updateReport`, `addNote`, `deleteNote`, `sendTeamMessage`, `deleteReport`, `stats`, `exportCSV` |

The reporter endpoints return a reduced object (`toReporterView`). It never includes internal notes, the assignee, the priority or the audit trail. Access codes are stored only as SHA-256 hashes and compared in constant time. The store simulates network latency so that loading states are exercised.

**Limitations (by design of a client-only demo):** anyone with access to the browser profile can read everything. Authentication is cosmetic, and there is no encryption at rest, no server-side authorization and no real anonymity.

## Production target

```
Browser ──HTTPS/TLS 1.3──► API gateway (rate limit, WAF, no IP logging on reporter routes)
                              │
                 ┌────────────┴─────────────┐
           Reporter API                Case API (SSO + MFA, RBAC)
                 │                           │
                 └──────► Service layer ◄────┘
                           │   │   │
         Encrypted DB  Object storage   Append-only audit log
        (envelope enc.,  (AV scan, EXIF/   (tamper-evident)
         KMS/HSM keys)    metadata strip)
```

1. **Swap the adapter.** Replace the internals of `store.js` with `fetch` calls that use the same method signatures. Views do not change.
2. **Reporter anonymity.** Do not log IP addresses, user agents or analytics on reporter routes, and do not require cookies. Issue a short-lived bearer token after the access code is verified with a slow KDF (Argon2id) and rate limiting.
3. **Authentication.** Use SAML or OIDC SSO with mandatory MFA. Keep sessions short and hold them in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
4. **Authorization.** Use RBAC with per-case access lists and conflict-of-interest exclusion, so that reports about a handler route around them. Grant the least privilege needed.
5. **Encryption.** Use TLS everywhere. Encrypt report bodies, messages and notes with field-level envelope encryption, with keys in a KMS or HSM. Consider end-to-end encryption for reporter messages.
6. **Attachments.** Upload directly to quarantined object storage, run antivirus scanning, strip metadata, and store files encrypted.
7. **Auditing.** Keep an append-only, tamper-evident log of every view and mutation.
8. **Retention and compliance.** Apply configurable retention, legal hold, and data-subject rights workflows. Align with the EU Whistleblower Directive, GDPR and SOX as applicable.
9. **Frontend hardening.** Use a strict CSP (the app already uses no inline handlers in views), Subresource Integrity or self-hosted fonts, and `Referrer-Policy: no-referrer`.
