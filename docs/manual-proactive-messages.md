# Manual proactive messages

Use the guarded `proactive` command to start a one-off outbound Lily message for an existing
user. It loads the user from Neon, wakes that user's persistent Mastra thread, generates the
message with the usual memory and safety context, and sends the resulting bubble through
Sendblue.

Do not insert rows directly into `mastra.mastra_messages`. A database insert does not wake the
agent or deliver an iMessage.

## Prerequisites

- Run from the repository root.
- Use environment variables from the same deployment as the target database. Production
  commands should use the linked Vercel production environment and `VERCEL_ENV=production` so
  Mastra uses the production Redis signal namespace.
- The user must exist, have completed onboarding, have current service consent, and have a valid
  E.164 phone number.
- Write an internal instruction for Lily, not text pretending to come from the user. Keep it
  transparent about why Lily is contacting them and avoid unnecessary sensitive data.

## 1. Dry-run the target

```bash
PATH="$HOME/.bun/bin:$PATH" VERCEL_ENV=production \
  vercel env run -e production -- \
  "$HOME/.bun/bin/bun" run proactive \
  --user-id usr_example \
  --prompt "Send a short transparent message explaining that we are testing proactive messaging. No reply is required."
```

The dry run checks account eligibility, the current consent version, and destination formatting. It
prints only operational metadata; it does not call the model or Sendblue.

## 2. Send

Repeat the reviewed command with both send safeguards:

```bash
PATH="$HOME/.bun/bin:$PATH" VERCEL_ENV=production \
  vercel env run -e production -- \
  "$HOME/.bun/bin/bun" run proactive \
  --user-id usr_example \
  --prompt "Send a short transparent message explaining that we are testing proactive messaging. No reply is required." \
  --send \
  --confirm-user-id usr_example
```

`Sendblue accepted` means the Sendblue API accepted the outbound request. Final device delivery
is asynchronous and should be confirmed from the Sendblue message status or delivery webhook.

## What happens

1. The command validates the user, onboarding state, consent version, and destination format.
2. `sendReminderToAgent` wraps the instruction as an internal proactive event.
3. `runAgentMessage` targets resource `<user-id>` and thread `skintext:<user-id>`.
4. Mastra wakes an idle thread or steers the event into its active run.
5. Lily produces the user-facing copy with retained context, locale, tools, and safety rules.
6. The API sends the reply through the normal Sendblue client.

## Troubleshooting

- `stored destination is not a valid E.164 phone number`: repair the user record from a verified
  destination before sending. Never guess a destination or print full phone numbers in logs.
- `consent version ... expected ...`: let the user accept the current Terms before proactive
  messaging.
- `No standalone outbound bubble`: the signal may have joined a message already being generated.
  Inspect the `scheduled_message` logs before retrying so the user does not receive a duplicate.
- A successful API request is not proof of device delivery. Check the resulting Sendblue status.
