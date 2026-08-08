# VibeCheck

**Autonomous Sandboxed QA & Visual UI/UX Auditor** — the zero-config reality check for vibe-coded repos.

Built for HackFusion 2026.

---

## The problem

AI coding tools (Cursor, Claude Code, Copilot) let you generate hundreds of lines of working-looking code in minutes. The app *looks* fine on first preview — but AI-generated code has a habit of shipping silent runtime flaws: unhandled API exceptions, state leaks, broken CSS on mobile. Setting up proper E2E tests or manually checking responsiveness across devices takes far longer than writing the code did, so those bugs usually ship.

## What VibeCheck does

Paste a GitHub URL. VibeCheck:

1. **Sandboxes it** — clones the repo into an isolated environment, auto-detects the framework, installs dependencies, and boots the dev server. Zero config.
2. **Sends a Ghost Agent after it** — a headless browser autonomously crawls your routes, clicks through the UI, and injects chaotic edge-case payloads (empty strings, emoji, script tags, oversized input) into every form field to surface exceptions a happy-path test would never hit.
3. **Audits it visually** — captures screenshots at desktop/tablet/mobile viewports and checks for horizontal overflow, overlapping elements, and (optionally, with an Anthropic API key) a Claude Vision pass for anything a heuristic would miss.
4. **Hands you the fix** — every issue is deduplicated, ranked by severity, and paired with a concrete suggested fix in `PATCH_NOTES.md`, ready to paste into your AI coding assistant of choice.

## Repo structure

```
vibecheck/
├── packages/
│   ├── orchestrator/     # Node/TS CLI — sandbox, Ghost Agent, visual audit, patch generation
│   └── dashboard/        # Next.js + Tailwind — hero landing page + scan results dashboard
├── docker/
│   └── sandbox.Dockerfile  # optional hardened container runtime for untrusted repos
└── .github/workflows/ci.yml
```

## Quick start

```bash
npm install

# run a scan against any public repo
npm run scan -- https://github.com/some-org/some-repo

# view results in the dashboard (defaults to a bundled sample report)
npm run dashboard
```

Open `http://localhost:3000` for the landing page, or `http://localhost:3000/dashboard` for the results view.

To point the dashboard at a real scan's output instead of the sample data:

```bash
VIBECHECK_REPORT_PATH=$(pwd)/.vibecheck/<timestamp>/report.json npm run dashboard
```

### Optional: Claude Vision + AI-drafted fixes

Set `ANTHROPIC_API_KEY` before running a scan to enable a second-opinion Claude Vision pass on the mobile screenshot, and an AI-drafted diff for the highest-severity issue:

```bash
export ANTHROPIC_API_KEY=sk-...
npm run scan -- https://github.com/some-org/some-repo
```

Without a key, VibeCheck still works end to end — heuristic layout checks (overflow, element collisions) and runtime error capture don't need one.

### Optional: hardened container isolation

The default sandbox is a temp directory + isolated process tree, which is enough for local/CI use. For scanning untrusted third-party repos in a hosted deployment, run the whole scan inside `docker/sandbox.Dockerfile` instead for a real filesystem/network boundary:

```bash
docker build -t vibecheck-sandbox -f docker/sandbox.Dockerfile .
docker run --rm -v $(pwd)/.vibecheck:/out vibecheck-sandbox \
  scan https://github.com/some-org/some-repo --out /out
```

## Tech stack

| Layer | Tech |
|---|---|
| Core Orchestrator | Node.js / TypeScript |
| Sandbox Runtime | Isolated temp dir + process tree (Docker path available) |
| Headless Browser Agent | Playwright |
| Vision & Intelligence Layer | Claude (Anthropic API), optional |
| Frontend Dashboard | Next.js + Tailwind CSS |

## Roadmap

- **GitHub CI/CD integration** — run VibeCheck on incoming PRs, block merges on broken UI
- **Cross-browser & device emulation** — Safari (WebKit), Firefox (Gecko), more mobile profiles
- **Self-healing test scripts** — update DOM selectors dynamically as the app evolves

## License

MIT
