import { Environment } from "../environment";
import { Network } from "../networks";

export function getEnvironmentPrefix(environment: Environment): string {
  return environment === Environment.prod ? "" : `${environment}-`;
}

function throwIfPublic(environment: Environment) {
  if (environment === Environment.public) {
    throw new Error("The public Environment is only available for mirror usage.");
  }
}

export function getSentinelUrl(environment: Environment, network: Network): string {
  throwIfPublic(environment);
  const environmentPrefix = getEnvironmentPrefix(environment);
  return `https://${network}.streams.${environmentPrefix}api.lworks.io`;
}

export function getMultichainMetricsUrl(environment: Environment, network: Network): string {
  throwIfPublic(environment);
  const environmentPrefix = getEnvironmentPrefix(environment);
  return `https://${network}.multichain-metrics.${environmentPrefix}api.lworks.io`;
}
