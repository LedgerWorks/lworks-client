// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TODO = any;

/** Represents basic object type with typed values */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Obj<ValueT = any> = Record<string, ValueT>;

/** An empty object with no keys. Using {} means any non-nullish value, not an object with no keys */
export type EmptyObj = Obj<never>;

export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
