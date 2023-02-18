import { Environment } from "./environment";
import { Network } from "./networks";

function getEnvironmentPrefix(environment: Environment): string {
  return environment === Environment.prod ? "" : `${environment}-`;
}

export function getMirrorUrl(environment: Environment, network: Network): string {
  const environmentPrefix = getEnvironmentPrefix(environment);
  return `https://${network}.${environmentPrefix}mirror.lworks.io`;
}

export function getSentinelUrl(environment: Environment, network: Network): string {
  const environmentPrefix = getEnvironmentPrefix(environment);
  return `https://${network}.streams.${environmentPrefix}api.lworks.io`;
}
