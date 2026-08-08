import { buildConversationPolicy, buildResponseShapePolicy } from "./foundation";
import { buildIdentityPolicy } from "./lily";
import { buildBodyImagePolicy, buildSafetyPolicy } from "./skincare";

export { buildConversationPolicy, buildResponseShapePolicy } from "./foundation";
export { buildIdentityPolicy } from "./lily";
export { buildBodyImagePolicy, buildSafetyPolicy } from "./skincare";

export function buildCorePrompt(): string {
  return [
    buildIdentityPolicy(),
    buildConversationPolicy(),
    buildResponseShapePolicy(),
    buildSafetyPolicy(),
    buildBodyImagePolicy(),
  ].join("\n\n");
}
