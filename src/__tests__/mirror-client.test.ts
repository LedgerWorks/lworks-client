import { MirrorOptions, callMirror } from "../clients/hedera-mirror/mirror-client";
import { setEnvironment, setNetwork } from "../config";
import { Network } from "../networks";
import { Environment } from "../environment";

describe("mirror client", () => {
  const originalTestnetToken = process.env.LWORKS_TESTNET_TOKEN;
  const originalMainnetToken = process.env.LWORKS_MAINNET_TOKEN;
  const originalToken = process.env.LWORKS_TOKEN;

  afterEach(() => {
    setNetwork(null);
    setEnvironment(null);
    process.env.LWORKS_TESTNET_TOKEN = originalTestnetToken;
    process.env.LWORKS_MAINNET_TOKEN = originalMainnetToken;
    process.env.LWORKS_TOKEN = originalToken;
    delete process.env.LWORKS_ENVIRONMENT;
    delete process.env.LWORKS_MIRROR_ENVIRONMENT;
  });

  function deleteEnvTokens(which: ("testnet" | "mainnet" | "generic")[]) {
    if (which.includes("generic")) {
      delete process.env.LWORKS_TOKEN;
    }
    if (which.includes("mainnet")) {
      delete process.env.LWORKS_MAINNET_TOKEN;
    }
    if (which.includes("testnet")) {
      delete process.env.LWORKS_TESTNET_TOKEN;
    }
  }

  async function verifyMirrorAccess(options?: MirrorOptions) {
    const accountId = "0.0.902";
    const result = await callMirror<{
      balances: Array<{
        account: string;
        balance: number;
        tokens: unknown;
      }>;
    }>(`/api/v1/balances?account.id=${accountId}`, options);

    expect(result).toHaveProperty("balances");

    const [accountDetails] = result.balances;
    expect(accountDetails.account).toEqual(accountId);
  }

  it("returns account balance for explicit public testnet network", async () => {
    deleteEnvTokens(["generic", "testnet", "mainnet"]);

    await verifyMirrorAccess({
      network: Network.Testnet,
      environment: Environment.public,
    });
  });

  it("returns account balance for environment public testnet network", async () => {
    deleteEnvTokens(["generic", "testnet", "mainnet"]);
    process.env.LWORKS_ENVIRONMENT = "public";
    await verifyMirrorAccess({
      network: Network.Testnet,
    });
  });

  it("returns account balance for mirror environment public testnet network", async () => {
    deleteEnvTokens(["generic", "testnet", "mainnet"]);
    process.env.LWORKS_ENVIRONMENT = "mainnet";
    process.env.LWORKS_MIRROR_ENVIRONMENT = "public";
    await verifyMirrorAccess({
      network: Network.Testnet,
    });
  });

  it("returns account balance for explicit public mainnet network", async () => {
    deleteEnvTokens(["generic", "testnet", "mainnet"]);

    await verifyMirrorAccess({
      network: "mainnet",
      environment: Environment.public,
    });
  });
});
