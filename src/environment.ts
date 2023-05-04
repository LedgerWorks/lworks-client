import { knownLookup } from "./enums";

export enum Environment {
  dev = "dev",
  stage = "stage",
  prod = "prod",
  public = "public",
}

export type LworksEnvironment = Environment.dev | Environment.stage | Environment.prod;

export function parseEnvironment(value: string): Environment {
  return knownLookup(Environment, value);
}
