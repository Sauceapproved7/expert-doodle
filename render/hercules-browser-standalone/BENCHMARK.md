# Hercules Browser — reproducible performance and release benchmark

This is a measurement plan, **not** a claim that Hercules outperforms other browsers.

## Existing local resolver benchmark
Run `npm test` from `render/hercules-browser-standalone`. The `search-benchmark.test.mjs` test reports median, p95 and p99 resolution time for five search/address scenarios (2,000 operations each). The benchmark measures only local JavaScript input resolution, not Google or DuckDuckGo response latency, navigation, rendering, network throughput or browser memory.

Record the commit SHA, Node version, OS, CPU, RAM, load, raw benchmark output and date with every run. Do not compare results from different hardware as though they were controlled.

## Browser comparison protocol (not yet executed)
Use the same hardware, OS, viewport, network profile and test URLs for Hercules and a baseline Chromium instance. Do not use production credentials or customer sessions. Use a local fixture server for reproducibility, and optionally public sites for a separate real-world pass.

1. **Cold navigation:** clear test profile cache; run at least 20 navigations to the same fixture. Record navigation start, response start, DOMContentLoaded, load and largest contentful paint where available.
2. **Warm navigation:** repeat 20 navigations with an established test profile; report medians and p95 separately from cold results.
3. **Memory:** measure resident memory of the browser process tree after startup, after 10 tabs/pages, and after closing them. Report peak and retained memory.
4. **Reliability:** execute 100 bounded sequential navigation cycles; report success count, timeouts, crashes and recovery behavior. Do not equate a successful HTTP response with successful rendered navigation.
5. **Security:** test unauthenticated API denial, session isolation, URL scheme rejection, owner-claim token redaction and offline-cache exclusions with fake credentials only.
6. **Mobile:** measure at mobile viewport, keyboard/omnibox focus preservation, layout overflow and tap-target usability on an actual phone.

## Release gates
- Repository tests pass on the exact candidate commit, with captured CI evidence.
- Browser smoke tests pass using a nonproduction authenticated test session.
- Security/provenance checks are documented on the exact candidate commit.
- Any new failures are fixed and tests repeated before merge.
- Production deploy requires a separately verified rollout and rollback path.

Never treat the resolver benchmark as a full-browser benchmark. No invented cross-browser ranking, percent improvement, or global score.
