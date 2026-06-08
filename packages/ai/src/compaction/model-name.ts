import { env } from "@skintext/shared";
import { DEFAULT_COMPACTION_MODEL } from "./constants";

export function getCompactionModelName(): string {
  return env.AI_GATEWAY_COMPACTION_MODEL || DEFAULT_COMPACTION_MODEL;
}
