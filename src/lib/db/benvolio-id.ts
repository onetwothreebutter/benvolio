/** Whether a value could be a Benvolio's id (a UUID), before asking the database. */
export function isBenvolioId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}
