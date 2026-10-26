# CLAUDE.md

This file says **how we work**. It delegates the rest:

- **What we build** (scope, requirements, targets, licensing, roadmap, Growth) →
  [`docs/PRD.md`](docs/PRD.md).
- **How it is built** (stack, module layout, simulation, level format, i18n,
  security architecture, build and deploy, observed original behavior) →
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

If a request conflicts with either document, say so before acting. If a change makes
either document wrong, update it in the same commit.

## 1. Project

**Return of the Runners**: a faithful browser fan remake of _Lode Runner: The Legend
Returns_ (Presage/Sierra, 1994), with an integrated level editor.

### Read before you start

| When you…                                     | Read first                                          |
| --------------------------------------------- | --------------------------------------------------- |
| start or scope a feature                      | `docs/PRD.md`, `docs/BACKLOG.md`                    |
| touch code, dependencies, CI or the build     | `docs/ARCHITECTURE.md`                              |
| implement or change gameplay                  | `docs/ARCHITECTURE.md` § Observed original behavior |
| add or change an asset (image, sound, level)  | `ASSETS.md`, `docs/PRD.md` § Content and licensing  |
| rely on a web API (clipboard, files, streams) | `docs/ARCHITECTURE.md` § Browser quirks             |

### Non-negotiables

Short on purpose: each rule is detailed in the linked document, but holds even when
you haven't read it.

- **No original game content.** Never commit assets, music or data extracted from the
  original game; every asset has an `ASSETS.md` entry (PRD § Content and licensing).
- **Pure, deterministic simulation.** Game logic never touches the DOM, time, audio
  or `Math.random` (ARCHITECTURE § Simulation).
- **Versioned level format.** Every format change ships with a migration and fixtures
  (ARCHITECTURE § Level format).
- **Level data is untrusted.** Validate at the boundary; never `innerHTML`/`eval`
  (ARCHITECTURE § Security).
- **Public repo.** Every commit is published: apply §5 "Privacy, secrets &
  publishing" before every push.

### Language

- Code, comments, commits, PRs and docs: **English**.
- No hard-coded user-facing strings: every UI string lands with all supported
  translations in the same commit (ARCHITECTURE § Internationalization).

---

## 2. Behavior

- Be direct and push back when you disagree; if my approach has problems, say so.
- When unsure about something, say you're unsure rather than guessing confidently.
- When something fails, investigate the root cause before retrying.
- Keep diffs scoped to the task: no drive-by reformats or unrelated refactors.
- After a significant or novel effort (a release, a multi-step feature, anything
  with surprises or irreversible steps), proactively offer to capture what was
  non-obvious into the relevant CLAUDE.md or memory.
  - Skip this for routine or trivial tasks — the point is signal, not ritual.

---

## 3. Teaching

I'm always picking up new systems and domains. When a key term surfaces that I
likely haven't internalized, explain it in 1–2 sentences and then move on.

Format:

```markdown
> 💡 One- or two-sentence explanation.
```

---

## 4. Tooling

### JavaScript / TypeScript

- Use **npm** with a committed `package-lock.json`; install with `npm ci` in CI.
- Pin the Node version in `.nvmrc` and `package.json#engines`.
- Before each commit, this must pass:

  ```sh
  npm run typecheck && npm run lint && npm test
  ```

### Python (scripts only, if ever needed)

- Always use **uv** (`uv venv`, `uv pip install`, `uv run`, `uvx`).
- Never use `python -m venv` or bare `pip`.

### Code style & conventions

- TypeScript `strict: true`; no `any` (use `unknown` + narrowing); no non-null `!`
  without a comment explaining why it is safe.
- ESLint + Prettier, enforced in CI; formatting is never mixed into a feature diff.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, …).
- Small PRs: one feature or fix per PR.

### Shell

- In shell chains that gate a commit, never pipe the test runner into a filter
  (`npm test | tail && git commit` masks failures).
- Check exit codes directly, or use `set -o pipefail`.

---

## 5. Engineering discipline

### Bugs & reviews

- Before reporting a suspected bug in a review, reproduce it with a small script or
  test; report measured behavior, not hypotheses.
- Every bug fix (review finding, backlog item) lands with a **regression test in the
  same commit** as the fix.
- When a test fails in CI but passes locally:
  1. Reproduce it in a matching environment (container).
  2. Check which side the oracle/spec says is correct _before_ relaxing the test.
  3. Remember that the committed artifact, not the test, may be the wrong side.

### Code review

- Every change goes through a **pull request**; nothing is pushed directly to `main`.
  A pushed branch is not done: open its PR in the same step and share the link.
- Before opening or updating a PR, run a self-review of the diff (`/code-review`)
  and fix confirmed findings first. Always ask: can an async result (file read,
  compression, clipboard, decoding) land after the state it was started for changed?
- Run `/security-review` on any PR that touches untrusted input (level import,
  share links, file loading), dependencies, or CI/deployment config.
- CI must be green (typecheck, lint, tests, build) before merge.
- **Definition of done** for a feature:
  1. playable in the deployed build;
  2. tested (enumerated unit tests, plus a replay test for gameplay changes);
  3. documented (PRD/ARCHITECTURE/BACKLOG statuses updated);
  4. strings translated (EN + FR);
  5. the PR shows a screenshot or GIF for any visible change, linked by commit SHA
     (a permalink), so it survives the branch's deletion.

### Security

The game is a static site with no backend, so the real attack surface is small and
specific. Focus on it:

- **Untrusted level data** (imported files, share links in the URL):
  - parse with a strict schema validator; reject unknown versions and oversized input
    (cap grid size, string lengths, decompressed size);
  - never inject level data into the DOM via `innerHTML`, `eval` or `new Function`;
    use `textContent`;
  - fuzz the level parser with randomized and malformed inputs.
- **Content Security Policy:** ship a strict CSP (`default-src 'self'`, no
  `unsafe-inline`/`unsafe-eval`, no third-party scripts at runtime).
- **Supply chain:**
  - keep runtime dependencies minimal; justify each new dependency in its PR;
  - committed lockfile, `npm ci` only; run `npm audit --omit=dev` in CI;
  - enable Dependabot (security updates) on the repo.
- **GitHub Actions:**
  - pin third-party actions to a full commit SHA;
  - set least-privilege `permissions:` per workflow (Pages deploy only gets
    `pages: write` and `id-token: write`);
  - never use `pull_request_target` with checkout of untrusted code.
- **Secrets:** the project needs none. Run a secret scanner (e.g. gitleaks) in CI
  over the full history, and enable GitHub secret scanning + push protection.

### Performance

- Before optimizing, **profile**: Chrome DevTools Performance panel, or
  `node --cpu-prof` for the headless simulation.
- Fix what the profiler shows, not what the analysis guessed.

### Testing

- For algorithmic code (monk AI pathfinding, collision, hole timers), prefer
  **randomized cross-checks against a naive reference implementation** over
  example-based tests alone.
- Implementation plans and stories **enumerate the unit tests explicitly**:
  - per module, the test files;
  - per test file, the specific behaviors they assert.
- A "correctness strategy" paragraph is not a substitute for the enumerated test list.

### Determinism & reproducibility

- Determinism claims need evidence: the simulation must **replay byte-for-byte**
  from a recorded input log.
  - Commit replay fixtures and assert the final state hash in tests.
- Keep engine-dependent behavior out of the simulation:
  - `Math.random` → use a seeded PRNG;
  - `Math.sin`, `cos`, `exp`, `log` and other transcendental functions (may differ
    by ~1 ulp across JS engines);
  - wall-clock time;
  - iteration order of objects keyed by numeric-looking strings.
- Cross-platform parity needs cross-engine evidence: run the replay tests in
  **at least two engines** (Node in CI + a headless browser via Playwright) before
  claiming it.
- The same holds for web platform APIs (streams, clipboard, downloads, storage): a
  claim about browser behavior is measured in Chromium, Firefox and WebKit, or stated
  as unverified.

### Faithfulness to the original

- Faithfulness to the original game is the **acceptance criterion for gameplay**.
- Record observed original behavior (timings, rules, edge cases) with provenance
  (video link + timestamp, or own playtest) in `docs/ARCHITECTURE.md`.
- Record every **intentional deviation** there too.

### Planning & backlog

- For multi-fix efforts (reviews, refactors):
  1. Record findings as a tracked backlog with acceptance criteria.
  2. Land **one commit per item**.
  3. Update the backlog status in the same commit.
- Maintain a **Growth** section in `docs/PRD.md` as the feature funnel:
  - new ideas and deferred scope land there first, with a status:
    `proposed` / `planned` / `done` / `rejected`;
  - scoped work graduates to the backlog;
  - statuses flip in the same commit that lands or rejects the feature.

### Documentation hygiene

- When changing documented behavior/semantics, sweep the whole repo for statements
  of the old behavior (docs, README, docstrings, test names, code comments).
- Update or delete them **in the same commit**: no dead code, no stale documentation.

### Privacy, secrets & publishing

- 🔒 **Before making a repo or package public (or publishing any artifact):**
  - scan the working tree **AND git history** for **secrets/PII**;
  - surface the **commit-author identity** that will become permanently public;
  - the current tree alone isn't enough — **history ships too**.
- Verify a published artifact in a **clean room**: test the deployed GitHub Pages
  build, or `vite preview` of a fresh `npm ci && npm run build` in a clean checkout,
  never the dev server. Say which one was checked.
