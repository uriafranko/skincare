import { getUser } from "@skintext/db";
import { CONSENT_VERSION } from "@skintext/shared";

interface CliOptions {
  userId: string;
  prompt: string;
  confirmUserId?: string;
  send: boolean;
}

const USAGE = `Usage:
  bun run proactive --user-id <user-id> --prompt <internal-instruction>
  bun run proactive --user-id <user-id> --prompt <internal-instruction> \\
    --send --confirm-user-id <user-id>

The first form is a dry run. The second wakes the user's Lily thread and sends
the generated reply through Sendblue.`;

function readValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1]?.trim();
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function parseArgs(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const userId = readValue(args, "--user-id");
  const prompt = readValue(args, "--prompt");
  if (!userId || !prompt) throw new Error(USAGE);
  if (prompt.length > 2_000) throw new Error("--prompt must be at most 2,000 characters.");

  return {
    userId,
    prompt,
    confirmUserId: readValue(args, "--confirm-user-id"),
    send: args.includes("--send"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const user = await getUser(options.userId);
  if (!user) throw new Error(`User ${options.userId} was not found.`);
  if (!user.onboardingComplete) throw new Error("The user's onboarding is incomplete.");
  if (!user.consentedAt) throw new Error("The user has not consented to service messages.");
  if (user.consentVersion !== CONSENT_VERSION) {
    throw new Error(
      `The user's consent version is ${user.consentVersion ?? "missing"}; expected ${CONSENT_VERSION}.`,
    );
  }

  const rawPhone = user.phone;
  if (!/^\+[1-9]\d{7,14}$/.test(rawPhone)) {
    throw new Error("The stored destination is not a valid E.164 phone number.");
  }

  const environment = process.env.VERCEL_ENV?.trim() || "local";
  console.log(
    JSON.stringify(
      {
        mode: options.send ? "send" : "dry-run",
        environment,
        userId: user.id,
        locale: user.locale,
        timezone: user.timezone,
        promptLength: options.prompt.length,
        destinationReady: true,
      },
      null,
      2,
    ),
  );

  if (!options.send) {
    console.log("Dry run complete. Add --send and --confirm-user-id to send.");
    return;
  }
  if (options.confirmUserId !== options.userId) {
    throw new Error("--confirm-user-id must exactly match --user-id when --send is used.");
  }
  if (environment === "local") {
    throw new Error(
      "VERCEL_ENV is unset. Set it to the target environment so Mastra uses the matching Redis signal namespace.",
    );
  }

  const { sendReminderToAgent } = await import("../workflows/steps/reminder-steps");
  const sent = await sendReminderToAgent(options.userId, options.prompt);
  if (!sent) {
    throw new Error(
      "No standalone outbound bubble was produced. The signal may have joined an active run; inspect logs before retrying.",
    );
  }
  console.log(`Sendblue accepted the proactive message for ${options.userId}.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Mastra's Redis pub/sub client intentionally keeps server processes alive.
// This one-shot operator command has finished all awaited generation, logging,
// and delivery work, so close the CLI process explicitly.
process.exit(0);
