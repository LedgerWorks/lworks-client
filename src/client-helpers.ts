import { getAccessToken, getNetwork } from "./config";
import { knownLookup } from "./enums";
import { Network } from "./networks";
import { baseLogger } from "./utils/logger";

export function getToken(network: Network): string | undefined {
  const networkToken =
    network === Network.Testnet
      ? process.env.LWORKS_TESTNET_TOKEN
      : process.env.LWORKS_MAINNET_TOKEN;

  const fallbackToken = process.env.LWORKS_TOKEN;

  const tokenValue = networkToken ?? fallbackToken ?? getAccessToken() ?? undefined;

  if (tokenValue === networkToken) {
    baseLogger.trace("using LWORKS_<network>_TOKEN");
  } else if (tokenValue === fallbackToken) {
    baseLogger.trace("using LWORKS_TOKEN");
  } else if (tokenValue) {
    baseLogger.trace("using configured access token");
  } else {
    baseLogger.warn("No access token from environment or global config");
  }

  return tokenValue;
}

export function ensureNetwork(options?: { network: Network | "mainnet" | "testnet" }) {
  if (typeof options !== "undefined") {
    return {
      network: knownLookup(Network, options.network),
    };
  }
  const configuredNetwork = getNetwork();
  if (configuredNetwork) {
    return {
      network: configuredNetwork,
    };
  }
  throw new Error("Unable to determine network to use");
}

export function timeElapsed(startedAt: number): number {
  return Date.now() - startedAt;
}
