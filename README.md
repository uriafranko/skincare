# Skintext

iMessage skincare routine assistant powered by AI.

## Stack

- **Runtime**: Bun + Turborepo monorepo
- **API**: Hono on Nitro
- **iMessage**: Sendblue adapter
- **AI**: AI SDK v6 + Vercel AI Gateway
- **Database**: Upstash Redis
- **Workflows**: Vercel Workflow SDK for durable reminders

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required keys:

| Variable | Source |
|---|---|
| `SENDBLUE_API_KEY` / `SENDBLUE_API_SECRET` | [sendblue.co](https://sendblue.co) |
| `SENDBLUE_FROM_NUMBER` | Your Sendblue phone number |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | [console.upstash.com](https://console.upstash.com) |
| `REDIS_URL` | Same Upstash Redis in `redis://` format |
| `AI_GATEWAY_API_KEY` | [vercel.com/ai-gateway](https://vercel.com/ai-gateway) |
| `AI_GATEWAY_DEFAULT_MODEL` | Default: `openai/gpt-5.4-mini` |
| `AI_GATEWAY_COMPACTION_MODEL` | Default: `openai/gpt-5.4-nano` |

### 3. Run locally

```bash
bun run dev
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

### 5. Set Sendblue webhook

Point your Sendblue incoming message webhook to:

```text
https://your-app.vercel.app/webhooks/sendblue
```

## Project Structure

```text
skintext/
  apps/
    api/                  # Hono API server
      src/
        index.ts          # Routes + webhook handler
        router.ts         # Onboarding vs assistant routing
      workflows/
        reminder-loop.ts  # Routine reminders and summaries
  packages/
    ai/                   # AI agent, prompts, and tools
    db/                   # Upstash Redis data layer
    shared/               # Types, locale, timezone utilities
```

## How It Works

1. User texts the Skintext number via iMessage.
2. Sendblue forwards the message via webhook.
3. New users go through conversational onboarding for skin goals, sensitivities, products, reminders, and consent.
4. Returning users interact with the AI assistant.
5. Photos are analyzed with the configured Gateway model for skin-photo, product-label, and routine-shelf support.
6. Text updates log routine steps, products, reactions, and skips.
7. Morning and evening reminders are timezone-aware.
8. End-of-day summaries report AM/PM completion, products used, and noted reactions.
9. Weekly recaps summarize adherence and routine patterns.
