import { env } from "@skintext/shared";
import { gateway } from "ai";

export function createDefaultGatewayModel() {
  return gateway(env.AI_GATEWAY_DEFAULT_MODEL);
}

export function createCompactionGatewayModel() {
  return gateway(env.AI_GATEWAY_COMPACTION_MODEL);
}
