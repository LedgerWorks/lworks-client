import { knownLookup } from "./enums";

export enum Environment {
  dev = "dev",
  stage = "stage",
  prod = "prod",
  public = "public",
}

export type LWorksEnvironment = Environment.dev | Environment.stage | Environment.prod;

export function parseEnvironment(value: string): Environment {
  return knownLookup(Environment, value);
}

export function parseLWorksEnvironment(value: string): LWorksEnvironment {
  const environment = knownLookup(Environment, value);
  if (environment === Environment.public) {
    throw new Error("public is not a valid LworksEnvironment");
  }
  return environment;
}
