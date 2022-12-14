import { createRule, deleteRuleById, getRuleById, getRules, upsertRule } from "../sentinel-client";
import { StreamsRuleType } from "../sentinel-types";
import { setNetwork } from "../config";
import { Network } from "../networks";

const runQualifier = Math.round(Math.random() * 10_000);
const actionWebhookUrl = "http://example.com";

async function getRulesForTestRun({ network }: { network: Network | "mainnet" | "testnet" }) {
  const rules = await getRules({ network });
  return rules.filter((r) => r.ruleName?.endsWith(`${runQualifier}-test`));
}
async function deleteRulesForNetwork(network: "mainnet" | "testnet") {
  const existingRules = await getRules({ network });

  await existingRules.reduce(async (pendingWork, rule) => {
    await pendingWork;
    if (rule.ruleName?.endsWith(`${runQualifier}-test`)) {
      await deleteRuleById(rule.ruleId, { network });
    }
  }, Promise.resolve());
}

jest.setTimeout(30_000);
describe("sentinel client", () => {
  afterAll(async () => {
    await Promise.all([deleteRulesForNetwork("mainnet"), deleteRulesForNetwork("testnet")]);
  });

  beforeEach(async () => {
    setNetwork(null);
  });

  it("gets existing rules", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const testnet = await getRulesForTestRun({ network: Network.Testnet });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toEqual(testnet.length);
  });

  it("can create a rule", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const createdRule = await createRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: `Hello ${Math.random()} from my ${runQualifier}-test`,
        actionWebhookUrl,
        chain: "hedera",
      },
      { network: "testnet" }
    );
    const updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    const foundRule = await getRuleById(createdRule.ruleId, { network: "testnet" });
    expect(createdRule).toEqual(foundRule);
  });

  it("can upsert a rule", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const createdRule = await upsertRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: `Hello ${Math.random()} from my ${runQualifier}-test`,
        actionWebhookUrl,
        chain: "hedera",
      },
      { network: "testnet" }
    );
    let updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    const updatedName = `Hello ${Math.random()} from my ${runQualifier}-test`;
    await upsertRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: updatedName,
        actionWebhookUrl,
        chain: "hedera",
      },
      { ruleId: createdRule.ruleId, network: "testnet" }
    );

    updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    const foundRule = await getRuleById(createdRule.ruleId, { network: "testnet" });
    expect(foundRule).toHaveProperty("ruleName", updatedName);
  });

  it("can delete a rule", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const createdRule = await createRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: `Hello ${Math.random()} from my ${runQualifier}-test`,
        actionWebhookUrl,
        chain: "hedera",
      },
      { network: "testnet" }
    );
    let updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    await deleteRuleById(createdRule.ruleId, { network: "testnet" });
    updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length).toEqual(updatedRules.length);
  });
});
