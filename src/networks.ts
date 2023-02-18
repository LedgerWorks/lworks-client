export enum Network {
  Mainnet = "mainnet",
  Testnet = "testnet",
}

const networkValues = Object.values(Network);

export type NetworkNames = typeof networkValues;
