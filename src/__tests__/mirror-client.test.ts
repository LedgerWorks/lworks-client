import { callMirror } from "../mirror-client";
import { setNetwork } from "../config";
import { Network } from "../networks";

describe("mirror client", () => {
  beforeEach(() => {
    setNetwork(null);
  });
  it("returns account balance for explicit network and LWORKS_TESTNET_TOKEN env", async () => {
    const accountId = "0.0.902";
    const result = await callMirror<{
      balances: Array<{
        account: string;
        balance: number;
        tokens: unknown;
      }>;
    }>(`/api/v1/balances?account.id=${accountId}`, { network: "testnet" });

    expect(result).toHaveProperty("balances");

    const [accountDetails] = result.balances;
    expect(accountDetails.account).toEqual(accountId);
  });

  it("returns account balance for explicit network and LWORKS_TOKEN env", async () => {
    const cachedValue = process.env.LWORKS_TESTNET_TOKEN;
    delete process.env.LWORKS_TESTNET_TOKEN;

    const accountId = "0.0.902";
    const result = await callMirror<{
      balances: Array<{
        account: string;
        balance: number;
        tokens: unknown;
      }>;
    }>(`/api/v1/balances?account.id=${accountId}`, { network: "testnet" });

    expect(result).toHaveProperty("balances");

    const [accountDetails] = result.balances;
    expect(accountDetails.account).toEqual(accountId);

    process.env.LWORKS_TESTNET_TOKEN = cachedValue;
  });

  it("returns account balance for configured network and LWORKS_MAINNET_TOKEN env", async () => {
    const accountId = "0.0.902";
    setNetwork(Network.Mainnet);
    const result = await callMirror<{
      balances: Array<{
        account: string;
        balance: number;
        tokens: unknown;
      }>;
    }>(`/api/v1/balances?account.id=${accountId}`);

    expect(result).toHaveProperty("balances");

    const [accountDetails] = result.balances;
    expect(accountDetails.account).toEqual(accountId);
  });
});
