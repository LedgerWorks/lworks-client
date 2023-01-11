/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  createRule,
  deleteRuleById,
  getRuleById,
  queryRules,
  getRules,
  upsertRule,
  findRule,
} from "../sentinel-client";
import { StreamsRule, StreamsRuleType } from "../sentinel-types";
import { setNetwork } from "../config";
import { Network } from "../networks";
import { knownLookup } from "../enums";

const runQualifier = Math.round(Math.random() * 10_000);
const actionWebhookUrl = "http://example.com";

function testRuleName(ruleNamePrefix: string) {
  return `${ruleNamePrefix} from my ${runQualifier}-test`;
}
function isTestRule(r: StreamsRule) {
  return r.ruleName?.endsWith(`${runQualifier}-test`);
}

async function getRulesForTestRun({ network }: { network: Network | "mainnet" | "testnet" }) {
  const { rules } = await queryRules({ network });
  return rules.filter(isTestRule);
}
async function deleteRulesForNetwork(network: "mainnet" | "testnet") {
  const { rules, next } = await queryRules({ network });

  await rules.reduce(async (pendingWork, rule) => {
    await pendingWork;
    if (isTestRule(rule)) {
      await deleteRuleById(rule.ruleId, { network });
    }
  }, Promise.resolve());

  if (next) {
    await deleteRulesForNetwork(network);
  }
}

jest.setTimeout(30_000);
describe("sentinel client", () => {
  afterAll(async () => {
    await Promise.all([deleteRulesForNetwork("mainnet"), deleteRulesForNetwork("testnet")]);
  });

  beforeEach(async () => {
    setNetwork(null);
  });

  it("can create a rule", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const createdRule = await createRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: testRuleName(`Hello ${Math.random()}`),
        actionWebhookUrl,
        chain: "hedera",
      },
      { network: "testnet" }
    );
    const updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    const foundRule = await getRuleById(createdRule.ruleId, { network: "testnet" });
    expect(createdRule).toEqual(foundRule);

    const findRuleResult = await findRule(
      createdRule.ruleType,
      createdRule.predicateValue,
      createdRule.ruleName!,
      { network: "testnet" }
    );

    expect(foundRule).toEqual(findRuleResult);
  });

  it("can upsert a rule", async () => {
    const result = await getRulesForTestRun({ network: "testnet" });
    const createdRule = await upsertRule(
      {
        predicateValue: "0.0.1234",
        ruleType: StreamsRuleType.HCSMessagesByTopicId,
        ruleName: testRuleName(`Hello ${Math.random()}`),
        actionWebhookUrl,
        chain: "hedera",
      },
      { network: "testnet" }
    );
    let updatedRules = await getRulesForTestRun({ network: Network.Testnet });
    expect(result.length + 1).toEqual(updatedRules.length);

    const updatedName = testRuleName(`Hello ${Math.random()}`);
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
        ruleName: testRuleName(`Hello ${Math.random()}`),
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

  describe("query tests", () => {
    let rules: StreamsRule[];
    const predicateValue = `0.0.${Math.round(Math.random() * 10000)}`;
    const ruleType = StreamsRuleType.HCSMessagesByTopicId;
    const ruleName = testRuleName("Query Tests");
    beforeAll(async () => {
      rules = await Promise.all(
        [1, 2, 3].map(() =>
          createRule(
            {
              predicateValue,
              ruleType,
              ruleName,
              actionWebhookUrl: `${actionWebhookUrl}?i=1`,
              chain: "hedera",
            },
            { network: "testnet" }
          )
        )
      );
    });

    it("returns all results with predicateValue, ruleType, and ruleName", async () => {
      const result = await queryRules({
        network: Network.Testnet,
        predicateValue,
        ruleType,
        ruleName,
      });

      expect(result.next).toBeUndefined();
      expect(result.rules.length).toEqual(3);
      rules.forEach((r) => expect(result.rules).toContainEqual(r));
    });

    it("returns all results with ruleType and ruleName", async () => {
      const result = await queryRules({
        network: Network.Testnet,
        ruleType,
        ruleName,
      });

      expect(result.next).toBeUndefined();
      expect(result.rules.length).toEqual(3);
      rules.forEach((r) => expect(result.rules).toContainEqual(r));
    });

    it("returns all results with ruleName", async () => {
      const result = await queryRules({
        network: Network.Testnet,
        ruleName,
      });

      expect(result.next).toBeUndefined();
      expect(result.rules.length).toEqual(3);
      rules.forEach((r) => expect(result.rules).toContainEqual(r));
    });

    it("throw error when predicate value specified without ruleType", async () => {
      expect(() =>
        queryRules({
          network: Network.Testnet,
          predicateValue,
        })
      ).rejects.toThrow();
    });

    it("can paginate", async () => {
      // eslint-disable-next-line no-await-in-loop
      const result1 = await queryRules({
        network: Network.Testnet,
        limit: 2,
        predicateValue,
        ruleType,
        ruleName,
      });
      expect(result1.rules.length).toEqual(2);
      expect(result1.next).toMatch(/\/api\/v1\/rules\?.*nextToken=.*/);

      const result2 = await queryRules({
        network: Network.Testnet,
        limit: 2,
        predicateValue,
        ruleType,
        ruleName,
        next: result1.next,
      });

      expect(result2.rules.length).toEqual(1);
      expect(result2.next).toBeUndefined();

      const allRules = result1.rules.concat(result2.rules);

      rules.forEach((r) => {
        expect(allRules).toContainEqual(r);
      });
    });
  });

  // DEPRECATED
  it("DEPRECATED -- getRules matches queryRules", async () => {
    const { rules: queryRulesResult } = await queryRules({ network: "testnet" });
    const getRulesResults = await getRules({ network: Network.Testnet });

    expect(Array.isArray(queryRulesResult)).toBe(true);
    expect(Array.isArray(getRulesResults)).toBe(true);
    expect(queryRulesResult.length).toEqual(getRulesResults.length);

    expect(queryRulesResult).toMatchObject(getRulesResults);
  });
});
