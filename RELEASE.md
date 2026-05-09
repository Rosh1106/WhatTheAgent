# Release Checklist

This is the checklist for cutting a public release of WhatTheAgent. The first time you run through it (going from "unpublished pre-1.0" to "public on npm + GitHub") is the longest; subsequent releases are mostly the "Cut a release" section.

## One-time setup before going public

### GitHub

- [ ] Make the repo public.
- [ ] Set the repo description to: *Local-first capability discovery for AI agent workspaces. Find what your skills, MCP servers, and scripts can actually do — and which combinations are dangerous.*
- [ ] Set the repo website to your npm or docs URL.
- [ ] Add topics: `ai-agent`, `agent-security`, `mcp`, `claude`, `codex`, `cursor`, `openclaw`, `hermes`, `security`, `cli`, `sast`.
- [ ] Enable **Issues**, **Discussions**, and **Security advisories** in repo settings.
- [ ] Confirm the [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) and [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) load correctly when filing a fresh issue / PR.
- [ ] Add a branch-protection rule on `main`: require PRs, require status checks (`CI`), require up-to-date branches.
- [ ] Add a `LICENSE` (already present — MIT).

### npm

- [ ] Create an [npm account](https://www.npmjs.com/signup) if you don't have one.
- [ ] Enable two-factor authentication on npm (`npm profile enable-2fa auth-and-writes`).
- [ ] Run `npm whoami` to confirm you're logged in.
- [ ] Run `npm pack --dry-run` and confirm only `dist/`, `examples/`, `readme/`, `skills/`, `README.md`, and `LICENSE` are included (already configured in `package.json` `files`).

### Author identity

- [ ] Replace the placeholder author email in `package.json` with one that's safe to be public — npm displays it.
- [ ] If you'd rather not expose your personal email, create a project email or alias and use it consistently in `package.json`, `SECURITY.md`, and `CODE_OF_CONDUCT.md`.

## Cut a release

For each release, in order:

### 1. Decide the version

WhatTheAgent uses [Semantic Versioning](https://semver.org/). Pre-1.0 means schema changes are allowed, but call them out clearly.

- `0.1.0` — first publish.
- `0.1.1` — bug fix only, no schema or CLI surface change.
- `0.2.0` — schema or CLI flag change. Bump `schemaVersion` if a JSON output changed.
- `1.0.0` — schema and CLI surface declared stable.

### 2. Update `CHANGELOG.md`

- Move everything under `## [Unreleased]` into a new dated heading: `## [X.Y.Z] - YYYY-MM-DD`.
- Add a fresh empty `## [Unreleased]` block above it.
- Update the link references at the bottom.

### 3. Verify locally

```bash
npm install
npm run typecheck
npm test
npm run build
npm run scan:example          # smoke test on examples/risky-agent
npm run understand:example
npm pack --dry-run
```

All four must be clean. The smoke tests catch regressions the unit tests don't.

### 4. Tag and publish

```bash
npm version patch              # or minor / major — bumps package.json + creates a tag
git push origin main
git push --tags
npm publish                    # 2FA prompt
```

### 5. Create a GitHub release

- Go to *Releases → Draft a new release*.
- Pick the tag you just pushed.
- Title: `v<version>`.
- Description: paste the matching CHANGELOG section. The animated demo SVG and mascot will render in the release page automatically if you embed them.

### 6. Smoke-check the published artifact

```bash
npm install -g whattheagent@<version>
wta --version                  # should print <version>
wta understand examples/risky-agent --output /tmp/wta-release-check
```

If anything's off, **unpublish within 72 hours** (`npm unpublish whattheagent@<version>`) and ship a `.1` patch. After 72 hours, npm only allows deprecation, not unpublish.

### 7. Tell people

- Update any external docs / blog posts.
- Post in `#open-source` on relevant Discords / Slacks if you have any.
- If this release fixes a tracked issue, comment on the issue and close it.

## Common pitfalls (first-time-publisher edition)

- **Don't push a tag without `npm publish`.** A v0.1.0 tag with no npm artifact looks broken.
- **Don't publish without 2FA.** npm has been a supply-chain attack vector twice in the last two years.
- **Don't include a hand-edited `dist/`.** The `prepack` script in `package.json` runs `npm run build` for you. Trust it.
- **Don't bump `schemaVersion` casually.** Downstream consumers (the chat skill, CI parsers) read it. Bump it only when something actually breaks compatibility, and document the break in `CHANGELOG.md`.
- **Don't change `package.json`'s `files` array carelessly.** It's the difference between shipping the dist and shipping your `node_modules`.

## Useful one-liners

```bash
# Show what would actually be published.
npm pack --dry-run | tail -50

# Verify the binary works directly from a clean install.
docker run --rm -it -v "$PWD":/work -w /work node:20 bash -lc \
  'npm install -g whattheagent && wta understand examples/risky-agent --chat'

# Generate a fresh demo screenshot for a release post.
wta understand examples/risky-agent --output /tmp/release && \
  open /tmp/release/report.html
```
