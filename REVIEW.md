# Review Guidelines

## Security-sensitive endpoints (highest priority)

- Unauthenticated routes (`/protect`, `/unsubscribe`, callbacks, one.gov.sg login): assume an attacker controls every header, param and body field.
- **Client IP:** `getRequestIp` trusts `cf-connecting-ip`, which a client can forge if it reaches the origin without Cloudflare. Do not use it alone as the key for a security control (rate limit, lockout, allowlist). Flag any new security use of it that has no backstop or trusted-proxy check.
- Lockouts: check whether an attacker can use the lockout to deny service to a legitimate user, and whether the PR documents that trade-off.

## Rate limiting (`express-rate-limit` + `rate-limit-redis`)

- Middleware order: `celebrate` validation and other 4xx-producing middleware must come **before** a failure-counting limiter. Otherwise malformed requests count as failed guesses.
- `skipSuccessfulRequests` / `skipFailedRequests` count a request before it finishes and undo the count afterwards, so concurrent in-flight requests count against each other. Flag this when correct requests could get a 429.
- Check that the status codes counted as failures are the intended ones (only 403 vs any status >= 400).
- Each limiter needs a unique Redis `prefix`, and `expiry` must match `windowMs`.

## Tests

- Calling `rateLimitClient.flushdb` in `afterEach` is the existing pattern (`email-transactional.routes.test.ts`) and is safe because backend `npm test` runs `jest --runInBand`. Only flag it if a PR removes `--runInBand` or flushes a non-rate-limit Redis.
- Security fixes need a test that shows the attack is blocked, plus a test that shows the legitimate path still works (correct password, a different IP).

## Conventions

- Raise errors with the classes in `core/errors/rest-api.errors.ts` (for example `ApiRateLimitError`) and let the shared error handler format the response.
- Use `loggerWithLabel(module)`. Never log password hashes, OTPs, tokens or request bodies.
- `backend` lint is `tsc --noEmit && eslint`. Root lint runs Prettier on `**/*.{yml,md}`.

## Ignore

- `package-lock.json` unless dependencies changed. Generated files under `frontend/build`.
- Known pre-existing CI failures not caused by the PR: root `lint` Prettier warning on `.github/workflows/codeql.yml`, and CodeQL `Analyze` 403 on private `opengovsg/*` query packs.
