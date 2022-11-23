/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
require("dotenv").config();
module.exports = {
  globalSetup: "<rootDir>/setup-jest.js",
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts"],
  transform: {
    "\\.ts$": "ts-jest",
    "\\.js$": "babel-jest",
  },
};
