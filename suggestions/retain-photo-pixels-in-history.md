# Retain Photo Pixels in Conversation History

Status: suggestion only; not implemented.

## Current behavior

When a user sends Lily a photo:

1. The API normalizes the attachment to JPEG and includes it in the model request for that turn.
2. The Mastra conversation stores a text-only marker instead of the raw image message.
3. If the user has enabled photo retention, the JPEG is saved separately in private blob storage for 30 days.
4. Conversation memory may retain the saved image ID and expiry as an operational pointer, but it does not retain the pixels or infer visual details from that pointer.
5. On a later turn, Lily must call `inspectUserImage`. The API downloads the saved blob and sends the pixels to the vision model again for a new analysis.

This means Lily can remember that a photo exists and may remember text previously said about it, but the model cannot directly examine the original pixels from ordinary conversation history. A later visual question depends on the separate blob-retrieval and inspection path.

Relevant implementation areas:

- `packages/ai/src/memory-policy.ts`
- `packages/ai/src/tools/user-images.ts`
- `apps/api/src/handlers/message.ts`
- `apps/api/src/user-images.ts`

## Suggested behavior

For users who have explicitly enabled photo retention, preserve the photo's visual content as part of its conversation history. Later turns should receive the retained pixels with the relevant historical message, allowing Lily to answer follow-up visual questions without first calling a separate inspection tool.

The behavior should remain bounded by the existing photo-retention agreement:

- Never retain pixels in history without explicit photo-retention consent.
- Apply the same 30-day expiry to the history attachment and the private blob.
- Remove the history attachment when the photo is deleted, expires, or the user disables retention.
- Keep account deletion capable of removing every stored copy.
- Do not allow observational or working memory to infer sensitive attributes from an attachment automatically.
- Avoid embedding unbounded base64 data in every prompt or duplicating image bytes across database records.

## Preferred implementation direction

Use a history attachment that is backed by the existing private blob rather than permanently copying base64 pixels into Mastra message text. When Mastra builds a turn that needs the historical photo, resolve the authorized attachment into image content for that model request. From Lily's perspective the pixels are available in conversation history, while storage, expiry, and deletion continue to have one source of truth.

If Mastra requires image bytes to be stored directly in its message records, first verify that expiration and deletion can be enforced across both Mastra and blob storage. Do not ship a second uncontrolled copy of a user's face photo.

## Expected benefits

- Follow-up requests such as “look at my whole face” can use the original photo naturally.
- Fewer visible failures caused by a separate tool-selection or retrieval step.
- Better continuity when the first response discussed only one part of the image.
- Less dependence on the model correctly selecting `inspectUserImage`.

## Costs and risks

- Historical photos may be sent to the model repeatedly, increasing latency and model cost.
- Facial and skincare photos are sensitive and require reliable consent, expiry, and deletion semantics.
- Large image messages can make conversation history expensive or exceed model context limits.
- Mastra observation, export, tracing, and backup behavior must be checked to prevent unintended copies.
- A history-backed attachment can still fail if its underlying storage or vision provider is unavailable, so retry and diagnostics remain necessary.

## Acceptance criteria

- A retained photo can be visually analyzed on a later text-only turn without Lily calling `inspectUserImage`.
- A non-retained photo is never available after its original turn.
- Expired and deleted photos cannot be resolved from either conversation history or tools.
- Raw pixels never appear in text memory, logs, traces, or observational summaries.
- Tests cover consent, expiry, deletion, account deletion, and a later follow-up visual question.
