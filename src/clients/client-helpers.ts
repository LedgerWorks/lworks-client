import { getAccessToken, getEnvironment, getNetwork } from "../config";
import { knownLookup } from "../enums";
import { Environment, parseEnvironment } from "../environment";
import { Network } from "../networks";
import { baseLogger } from "../utils/logger";

function getToken(network: Network): string | undefined {
  const networkToken =
    network === Network.Testnet
      ? process.env.LWORKS_TESTNET_TOKEN
      : process.env.LWORKS_MAINNET_TOKEN;

  const fallbackToken = process.env.LWORKS_TOKEN;

  const tokenValue = networkToken ?? fallbackToken ?? getAccessToken() ?? undefined;

  if (tokenValue === networkToken) {
    baseLogger.trace({ network }, "using LWORKS_<network>_TOKEN");
  } else if (tokenValue === fallbackToken) {
    baseLogger.trace("using LWORKS_TOKEN");
  } else if (tokenValue) {
    baseLogger.trace("using configured access token");
  } else {
    baseLogger.warn("No access token from environment or global config");
  }

  return tokenValue;
}

export function ensureAccessToken(network: Network, options?: { accessToken?: string }) {
  const accessToken = options?.accessToken ?? getToken(network);
  if (!accessToken) {
    throw new Error(
      "AccessToken is not configured. Configure accessToken globally with 'configure', set the environment variable corresponding to network, or pass in options on the request."
    );
  }

  return { accessToken };
}

export function ensureNetwork(options?: { network?: Network | "mainnet" | "testnet" }) {
  if (typeof options !== "undefined" && options.network) {
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
  throw new Error(
    "Network is not configured. Configure network globally with 'configure' or pass in options on the request."
  );
}

export function ensureEnvironment(
  options: Partial<{
    environment: Environment;
    environmentLookup: string;
  }> = {}
): Environment {
  if (options.environment) return options.environment;

  const fromGlobal = getEnvironment();
  if (fromGlobal) return fromGlobal;

  const fromOptionEnvironment = options.environmentLookup
    ? process.env[options.environmentLookup]
    : null;
  if (fromOptionEnvironment) return parseEnvironment(fromOptionEnvironment);

  const fromCommonEnvironment = process.env.LWORKS_ENVIRONMENT;
  if (fromCommonEnvironment) return parseEnvironment(fromCommonEnvironment);

  return Environment.prod;
}

export function timeElapsed(startedAt: number): number {
  return Date.now() - startedAt;
}

// Bad request, unauthorized, not found should bail retries by default
const defaultBailStatuses = [400, 401, 404];

export function shouldBailRetry(
  response: Response,
  bailRetryStatuses: number[] = defaultBailStatuses
) {
  return bailRetryStatuses.includes(response.status);
}
