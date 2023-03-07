import { Environment } from "./environment";
import { Network } from "./networks";

export const libraryVersion = "2.8.0";

type Config = {
  disableTracking: boolean;
  network: null | Network;
  environment: null | Environment;
  accessToken: null | string;
};

const config: Config = {
  disableTracking: false,
  network: null,
  environment: null,
  accessToken: null,
};

/**
 * Update multiple config values
 * @param options partial config object`
 */
export function configure(options: Partial<Config>) {
  Object.assign(config, options);
}

/**
 * Gets the status of metrics collection, defaults to true
 * @returns boolean indicating if usage metrics are disabled
 */
export function getDisabledTracking() {
  return config.disableTracking;
}

/**
 * Disable anonymous usage metrics collection
 */
export function disableTracking() {
  config.disableTracking = true;
}

export function enableTracking() {
  config.disableTracking = false;
}

/**
 * Assign default network used when calling `callMirror` with only an endpoint
 * @param network mainnet|testnet
 */
export function setNetwork(network: Network | null) {
  config.network = network;
}

export function getNetwork() {
  if (!config.network) {
    console.warn("network is not set");
  }
  return config.network;
}

/**
 * Assign default environment used when calling `callMirror` with only an endpoint
 * @param environment dev|stage|prod
 */
export function setEnvironment(environment: Environment) {
  config.environment = environment;
}

export function getEnvironment() {
  return config.environment;
}

/**
 * Programmatically assign a network token, environment variables will override this.
 * @param network mainnet|testnet
 */
export function setAccessToken(accessToken: string) {
  config.accessToken = accessToken;
}

export function getAccessToken() {
  if (!config.accessToken) {
    console.warn("accessToken is not set");
  }
  return config.accessToken;
}
