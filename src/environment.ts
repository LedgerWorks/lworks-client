import { knownLookup } from "./enums";

export enum Environment {
  dev = "dev",
  stage = "stage",
  prod = "prod",
}

export function parseEnvironment(value: string): Environment {
  return knownLookup(Environment, value);
}
