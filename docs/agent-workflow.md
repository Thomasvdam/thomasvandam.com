# Agent workflow

Project guidance lives in [AGENTS.md](../AGENTS.md). This repository follows
the task branch and hook conventions used by the other local projects.

## Session context and hooks

```sh
./scripts/install-hooks
./scripts/session-context
```

The installer sets repository-local `core.hooksPath=.githooks` and refuses to
replace a different configured hook path. The `pre-commit` hook requires a
`codex/` task branch and checks staged whitespace. The `pre-push` hook blocks
direct pushes to `main` and validates the clean checked-out task commit before
it is pushed under its own branch name.

`.codex/hooks.json` runs the read-only `session-context` script at startup,
resume, clear, and compaction. The Codex client must trust the project hook
definition before it runs automatically; use `session-context` manually when
needed.

## Task lifecycle and delegation

For a new implementation task, the orchestrator starts from a clean checkout:

```sh
./scripts/start-task improve-homepage
```

The primary agent owns the branch, hook installation, commits, validation, and
delivery. It may delegate bounded implementation or investigation to subagents;
delegated agents preserve unrelated work and do not run competing branch,
commit, push, hook, or pull-request lifecycle operations. Sequential user tasks
are committed separately on the same task branch after each scope is complete.

Run the complete check before each task commit:

```sh
./scripts/check
git add <task-files>
git commit -m 'fix(site): describe the behavior'
```

The check validates shell syntax and the isolated workflow suite, installs the
locked Bun dependencies, runs Next.js lint and production build, and checks Git
whitespace. There is no automated UI test suite, so manually exercise affected
routes after the build and keep that evidence separate from build success.

When an origin is configured, finish a clean task branch with:

```sh
./scripts/finish-task --title 'fix(site): describe the behavior' --body-file /tmp/thomasvandam-pr.md
```

This validates again, confirms the branch includes current `origin/main`, and
creates or updates the pull request without merging it. It never stashes,
resets, or discards work.
