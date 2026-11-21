/** The refusals raised by the SQL functions in supabase/migrations, by SQLSTATE. */
const REFUSALS = {
  BVINV: "invite_not_found",
  BVOWN: "own_invite",
  BVPRO: "no_profile",
} as const;

export type Refusal = (typeof REFUSALS)[keyof typeof REFUSALS];

/** Which refusal an RPC error is, or null for anything unexpected. */
export function refusal(error: { code?: string } | null): Refusal | null {
  const code = error?.code;
  return code && Object.hasOwn(REFUSALS, code) ? REFUSALS[code as keyof typeof REFUSALS] : null;
}

/** Whether an insert hit a unique key: the row is there already. */
export function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
