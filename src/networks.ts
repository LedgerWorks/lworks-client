export enum Network {
  Mainnet = "mainnet",
  Testnet = "testnet",
}

const networkValues = Object.values(Network);

export type NetworkNames = typeof networkValues;

export const NetworkHostMap: Record<Network, string> = {
  [Network.Mainnet]: "https://mainnet.mirror.lworks.io",
  [Network.Testnet]: "https://testnet.mirror.lworks.io",
};
