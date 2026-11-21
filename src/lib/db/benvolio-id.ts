/** Whether a value could be a Benvolio's id (a UUID), before asking the database. */
export function isBenvolioId(id: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(id);
}
