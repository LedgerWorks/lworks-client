import { Environment } from "../../environment";
import { Network } from "../../networks";
import { getEnvironmentPrefix } from "../urls";

export function getMirrorUrl(environment: Environment, network: Network): string {
  if (environment === Environment.public) {
    return network === Network.Testnet
      ? "https://testnet.mirrornode.hedera.com"
      : "https://mainnet-public.mirrornode.hedera.com";
  }
  const environmentPrefix = getEnvironmentPrefix(environment);
  return `https://${network}.${environmentPrefix}mirror.lworks.io`;
}
