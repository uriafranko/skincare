# AGENTS.md

Lily is a Bun/Turborepo monorepo for an iMessage skincare routine assistant. Internal package names and stable storage keys still use `skintext`. Keep this file short: only durable facts and commands that future agents should use almost every time.

## Project Map

- `apps/api`: Hono/Nitro API, Sendblue webhook routing, onboarding, returning-user messages, reminder workflows.
- `apps/web`: Next.js public web app.
- `packages/ai`: Mastra agents, Postgres-backed observational memory, prompts, onboarding, and tools.
- `packages/db`: Drizzle/Neon data layer for users, onboarding state, products, routine logs, and reminders.
- `packages/shared`: Shared types, env validation, locale/timezone helpers, and constants.
- `packages/sim`: Local onboarding simulator.
- `docs/local-simulator.md`: Simulator workflow reference.
- `docs/message-surfaces.md`: Voice and message-format boundaries.
- `suggestions`: Future product and architecture proposals that are not yet implemented; each file should record the current behavior, proposed change, tradeoffs, and acceptance criteria.

## Runtime Notes

This repo is Bun-based. In Codex desktop shells, `bun` may not be on `PATH`; use `$HOME/.bun/bin/bun` and prepend `$HOME/.bun/bin` because root scripts can invoke `bun` again.

Do not `source .env`. The root `.env` can contain shell metacharacters, so shell sourcing can fail. Use `node -r dotenv/config` when a command needs env vars.

Root `.env` contains `AI_GATEWAY_API_KEY`. Some isolated tests import shared env validation and may also require Sendblue variables; use dummy Sendblue values only for tests that do not exercise Sendblue behavior.

`packages/db` uses Drizzle's Neon HTTP driver. Do not use `db.transaction()`; it throws at runtime. Use `db.batch()` or separate statements.

Mastra stores agent threads, messages, and observations in the `mastra` schema of the same Postgres database. Keep business data in `packages/db`; do not reintroduce custom conversation or memory tables.

## Common Commands

```bash
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" run lint
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" run test
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" run sim --system stub --scenario all
```

Targeted prompt/simulator tests:

```bash
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" test \
  packages/sim/src/__tests__/runner.test.ts \
  packages/ai/src/__tests__/prompts.test.ts
```

If env validation blocks those targeted tests, run them through dotenv with dummy Sendblue values:

```bash
node -r dotenv/config -e 'const { spawnSync } = require("child_process");
const bun = `${process.env.HOME}/.bun/bin/bun`;
const env = {
  ...process.env,
  SENDBLUE_API_KEY: process.env.SENDBLUE_API_KEY ?? "test",
  SENDBLUE_API_SECRET: process.env.SENDBLUE_API_SECRET ?? "test",
  SENDBLUE_FROM_NUMBER: process.env.SENDBLUE_FROM_NUMBER ?? "+15555550123",
  SENDBLUE_WEBHOOK_SECRET: process.env.SENDBLUE_WEBHOOK_SECRET ?? "test",
  PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH ?? ""}`,
};
const r = spawnSync(bun, ["test",
  "packages/sim/src/__tests__/runner.test.ts",
  "packages/ai/src/__tests__/prompts.test.ts",
], { cwd: process.cwd(), env, stdio: "inherit" });
process.exit(r.status ?? 1);'
```

## Simulator

List scenarios:

```bash
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" run sim list
```

Run deterministic local onboarding:

```bash
PATH="$HOME/.bun/bin:$PATH" "$HOME/.bun/bin/bun" run sim --system stub --scenario all --json
```

Run live onboarding with root `.env`:

```bash
node -r dotenv/config -e 'const { spawnSync } = require("child_process");
const bun = `${process.env.HOME}/.bun/bin/bun`;
const env = { ...process.env, PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH ?? ""}` };
const r = spawnSync(bun, ["run", "sim", "--system", "live", "--scenario", "all", "--json"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
process.exit(r.status ?? 1);'
```

Useful scenarios:

- `onboarding-basic`
- `onboarding-consent-gap`
- `onboarding-friction`

## Frequent Hotspots

- Onboarding prompt: `packages/ai/src/prompts/onboarding.ts`; extraction/signals: `packages/ai/src/onboarding.ts`.
- Deterministic onboarding simulator: `packages/sim/src/stub-onboarding.ts`.
- Local onboarding completion rules: `packages/sim/src/onboarding-state.ts`.
- Main assistant system prompt: `packages/ai/src/prompts/main.ts`; shared policy: `packages/ai/src/prompts/core.ts`.
- API onboarding persistence/user creation: `apps/api/src/handlers/onboarding.ts`.
- Returning-user message path: `apps/api/src/handlers/message.ts`.

## Onboarding Defaults

- Keep setup short and one-bubble when possible.
- Do not ask for fields already provided.
- If only consent is missing, ask only for an explicit `AGREE` to skincare-data storage and the linked Terms; include both the Terms and Privacy URLs.
- Treat `unsure` as valid for skin type or sensitivity.
- Avoid form language such as `please provide`, `required fields`, or `the following`.
- Completion copy should stay compact: `All set. Text done after your routine, or send a skin/product photo anytime you want help placing something.`
