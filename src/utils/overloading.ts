import { getNetwork } from "../config";
import { knownLookup, lookup } from "../enums";
import { Network } from "../networks";

export function parseArgs(
  networkOrValue: string | Network,
  value?: string
): { network: Network; value: string } {
  if (typeof value === "string") {
    return { network: knownLookup(Network, networkOrValue), value };
  }

  const configuredNetwork = getNetwork();
  if (configuredNetwork && networkOrValue) {
    return { network: configuredNetwork, value: networkOrValue };
  }

  throw new Error("Unexpected invocation");
}

export function parseArgsAlt<T = string | number>(
  networkOr: T | Network,
  ...args: Array<T | undefined>
): { network: Network; args: T[] } {
  const lookedUp = typeof networkOr === "string" ? lookup(Network, networkOr) : undefined;
  if (
    typeof args.at(-1) !== "undefined" &&
    lookedUp &&
    args.every((x) => typeof x !== "undefined")
  ) {
    return { network: lookedUp, args: args as T[] };
  }

  const configuredNetwork = getNetwork();
  if (configuredNetwork && args.slice(0, -1).every((x) => typeof x !== "undefined")) {
    return { network: configuredNetwork, args: [networkOr, ...args] as T[] };
  }

  throw new Error("Unexpected invocation");
}
