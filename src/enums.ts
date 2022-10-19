/* eslint-disable no-restricted-syntax */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StringEnum = { [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NumericEnum = { [key: number]: any };
type AllTheEnums = StringEnum | NumericEnum;
// eslint-disable-next-line @typescript-eslint/ban-types
function keysOf<K extends {}>(o: K): (keyof K)[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function keysOf(o: any) {
  return Object.keys(o);
}

function stringLookup<E extends StringEnum>(stringEnum: E, s: string): E[keyof E] | undefined {
  for (const enumKey of keysOf(stringEnum)) {
    if (stringEnum[enumKey] === s) {
      return stringEnum[enumKey] as E[keyof E];
    }
  }
  return undefined;
}

function numericLookup<E extends NumericEnum>(numericEnum: E, n: number): E[keyof E] | undefined {
  for (const enumKey of keysOf(numericEnum)) {
    if (numericEnum[enumKey] === n) {
      return numericEnum[enumKey] as E[keyof E];
    }
  }
  return undefined;
}

export function lookup<E extends NumericEnum>(someEnum: E, v: number): E[keyof E] | undefined;
export function lookup<E extends StringEnum>(someEnum: E, v: string): E[keyof E] | undefined;
export function lookup<E extends AllTheEnums>(
  someEnum: E,
  v: string | number | undefined
): E[keyof E] | undefined {
  if (typeof v === "string") {
    return stringLookup(someEnum, v);
  }
  if (typeof v === "number") {
    return numericLookup(someEnum, v);
  }
  return undefined;
}

export function knownLookup<E extends NumericEnum>(someEnum: E, v: number): E[keyof E];
export function knownLookup<E extends StringEnum>(someEnum: E, v: string): E[keyof E];
export function knownLookup<E extends AllTheEnums>(someEnum: E, v: string | number): E[keyof E] {
  // eslint-disable-next-line sonarjs/no-all-duplicated-branches
  const lookupValue = typeof v === "string" ? lookup(someEnum, v) : lookup(someEnum, v);
  if (typeof lookupValue !== "undefined") {
    return lookupValue;
  }
  throw new Error(`Known value didn't exist, ${v}`);
}
