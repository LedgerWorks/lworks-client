import { knownLookup } from "./enums";

export enum Network {
  Mainnet = "mainnet",
  Testnet = "testnet",
}

const networkValues = Object.values(Network);

export type NetworkNames = typeof networkValues;

export function parseNetwork(value: string): Network {
  return knownLookup(Network, value);
}
