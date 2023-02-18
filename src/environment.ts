export enum Environment {
  dev = "dev",
  stage = "stage",
  prod = "prod",
}

export function parseEnvironment(value: string | null | undefined): Environment | null {
  if (!value) return null;
  return Environment[value as keyof typeof Environment];
}
