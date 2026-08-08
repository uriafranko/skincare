#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs as parseNodeArgs } from "node:util";
import { createOnboardingRuntime, resolvedRuntimeMode } from "./onboarding-runtime";
import { createPersonaDriver } from "./personas";
import { createPolicyRuntime } from "./policy-runtime";
import { formatScenarioList, formatSimulationReport } from "./report";
import { runSimulation } from "./runner";
import { getScenario, scenarios } from "./scenarios";
import type { PersonaMode, RuntimeMode, SimulationScenario, TranscriptMessage } from "./types";

type Command = "run" | "list" | "play";

interface CliOptions {
  command: Command;
  scenario: string;
  system: RuntimeMode;
  persona: PersonaMode;
  model?: string;
  maxTurns?: number;
  json: boolean;
  out?: string;
  task?: string;
}

export function parseArgs(argv: string[]): CliOptions {
  const first = argv[0];
  const command: Command = first === "list" || first === "play" || first === "run" ? first : "run";
  const args = command === first ? argv.slice(1) : argv;

  const { values, positionals } = parseNodeArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      scenario: { type: "string" },
      system: { type: "string" },
      persona: { type: "string" },
      model: { type: "string" },
      "max-turns": { type: "string" },
      json: { type: "boolean" },
      out: { type: "string" },
      task: { type: "string" },
    },
  });

  if (positionals.length > 0) {
    throw new Error(`Unexpected argument: ${positionals[0]}`);
  }

  const system = values.system ?? "auto";
  if (system !== "auto" && system !== "live" && system !== "stub") {
    throw new Error(`Invalid --system value: ${system}. Expected auto, live, or stub.`);
  }

  const persona = values.persona ?? "scripted";
  if (persona !== "scripted" && persona !== "model") {
    throw new Error(`Invalid --persona value: ${persona}. Expected scripted or model.`);
  }

  let maxTurns: number | undefined;
  if (values["max-turns"] !== undefined) {
    maxTurns = Number(values["max-turns"]);
    if (!Number.isInteger(maxTurns) || maxTurns < 1) {
      throw new Error("--max-turns must be a positive integer.");
    }
  }

  return {
    command,
    scenario: values.scenario ?? "onboarding-basic",
    system,
    persona,
    model: values.model,
    maxTurns,
    json: values.json ?? false,
    out: values.out,
    task: values.task,
  };
}

function scenarioWithTask(scenario: SimulationScenario, task?: string): SimulationScenario {
  return task ? { ...scenario, task } : scenario;
}

async function writeOutput(path: string, value: unknown) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await Bun.write(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function runScenarios(options: CliOptions) {
  const selected =
    options.scenario === "all"
      ? scenarios
      : [scenarioWithTask(getScenario(options.scenario), options.task)];

  const results = [];
  for (const scenario of selected) {
    const runtime =
      scenario.area === "personality_safety"
        ? createPolicyRuntime(scenario, {
            mode: options.system,
            model: options.model,
          })
        : createOnboardingRuntime({
            mode: options.system,
            model: options.model,
            locale: scenario.locale,
            timezone: scenario.timezone,
          });
    const persona = createPersonaDriver(scenario, options.persona, options.model);
    results.push(
      await runSimulation(scenario, runtime, persona, {
        maxTurns: options.maxTurns,
      }),
    );
  }

  if (options.out) await writeOutput(options.out, results.length === 1 ? results[0] : results);

  if (results.some((result) => !result.evaluation.pass)) process.exitCode = 1;

  if (options.json) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  if (results.length === 1) {
    const [result] = results;
    if (!result) throw new Error("No simulation result was produced.");
    console.log(formatSimulationReport(result));
    return;
  }

  console.log(formatScenarioList(results));
}

async function play(options: CliOptions) {
  const scenario = scenarioWithTask(getScenario(options.scenario), options.task);
  const mode = resolvedRuntimeMode(options.system);
  const runtime =
    scenario.area === "personality_safety"
      ? createPolicyRuntime(scenario, { mode, model: options.model })
      : createOnboardingRuntime({
          mode,
          model: options.model,
          locale: scenario.locale,
          timezone: scenario.timezone,
        });
  const transcript: TranscriptMessage[] = [];
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(`Playing ${scenario.id} with ${runtime.id}. Type "exit" to stop.`);

  for (let turn = 0; turn < (options.maxTurns ?? scenario.maxTurns ?? 12); turn += 1) {
    const userText = (await rl.question("you> ")).trim();
    if (!userText || userText.toLowerCase() === "exit") break;

    transcript.push({ role: "user", content: userText, turn });
    const reply = await runtime.receive(userText, { scenario, transcript, turn });

    for (const message of reply.messages) {
      transcript.push({ role: "assistant", content: message, turn, state: reply.state });
      console.log(`lily> ${message}`);
    }

    if (reply.complete) {
      console.log("Simulation complete.");
      break;
    }
  }

  rl.close();
}

function listScenarios() {
  for (const scenario of scenarios) {
    console.log(`${scenario.id}: ${scenario.title}`);
  }
}

async function main() {
  const options = parseArgs(Bun.argv.slice(2));

  if (options.command === "list") {
    listScenarios();
    return;
  }

  if (options.command === "play") {
    await play(options);
    return;
  }

  await runScenarios(options);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
