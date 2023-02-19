import { Chain, parseChain } from "../chain";

describe("parseChain", () => {
  const testCases = [
    { value: "hedera", expected: Chain.Hedera },
    { value: "avalanche", expected: Chain.Avalanche },
  ];
  testCases.forEach(({ value, expected }) => {
    it(`should parse chain value: ${value}`, () => {
      expect(parseChain(value)).toBe(expected);
    });
  });

  it("should throw an exception when an unknown chain provided", () => {
    expect(() => parseChain("shlurpyshlurp")).toThrow("Known value didn't exist, shlurpyshlurp");
  });
});
