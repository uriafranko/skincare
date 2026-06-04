# Local Simulator

The simulator is a local harness for playing through Skintext flows without Sendblue webhooks. It is designed for iteration tasks such as "optimize onboarding": run a persona, inspect the transcript, change prompts or flow logic, and rerun the same scenario.

## Commands

List scenarios:

```bash
bun run sim list
```

Run the default onboarding scenario:

```bash
bun run sim
```

Run all scripted scenarios:

```bash
bun run sim --scenario all
```

Write a machine-readable run artifact:

```bash
bun run sim --scenario onboarding-friction --out .simulations/onboarding-friction.json
```

Manually play with the onboarding runtime:

```bash
bun run sim play --scenario onboarding-friction
```

## Live vs Stub

By default `--system auto` uses the live Gateway model when `AI_GATEWAY_API_KEY` is present and falls back to the deterministic stub otherwise.

Force deterministic local mode:

```bash
bun run sim --system stub --scenario onboarding-consent-gap
```

Force live onboarding:

```bash
bun run sim --system live --scenario onboarding-consent-gap
```

You can also use a model-driven simulated user:

```bash
bun run sim --system live --persona model --scenario onboarding-friction
```

## Iteration Workflow

1. Pick a scenario that matches the task, or add one in `packages/sim/src/scenarios.ts`.
2. Run it with `--system live` to exercise the real onboarding prompt.
3. Review the transcript and checks.
4. Adjust onboarding prompts or flow logic.
5. Rerun the same scenario and compare score, turns, and captured final state.

The first evaluator focuses on onboarding completion, required field capture, assistant message count, reply length, internal-boundary leaks, and obvious re-asks for already collected fields.
