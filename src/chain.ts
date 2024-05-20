import { knownLookup } from "./enums";

export enum Chain {
  Hedera = "hedera",
  Avalanche = "avalanche",
  Ethereum = "ethereum",
  Kava = "kava",
  Evmos = "evmos",
  Flare = "flare",
  Arbitrum = "arbitrum",
  Polygon = "polygon",
  Offchain = "offchain",
}

/**
 * Keeping direct string specification around to avoid breaking existing clients
 * New chains shouldn't be added here in favor of direct enum or parseChain calls
 */
export type LegacyChainStrings = "hedera" | "avalanche";

export function parseChain(value: string): Chain {
  return knownLookup(Chain, value);
}
