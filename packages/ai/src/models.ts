import {
  env,
  resolveCompactionGatewayModelName,
  resolveDefaultGatewayModelName,
} from "@skintext/shared";
import { gateway } from "ai";

export function getDefaultGatewayModelName(): string {
  return resolveDefaultGatewayModelName(env);
}

export function getCompactionGatewayModelName(): string {
  return resolveCompactionGatewayModelName(env);
}

export function createDefaultGatewayModel() {
  return gateway(getDefaultGatewayModelName());
}

export function createCompactionGatewayModel() {
  return gateway(getCompactionGatewayModelName());
}
