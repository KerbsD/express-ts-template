const INT4_MAX = 2_147_483_647;

// Strict positive int4. Rejects "1e3", "0x10", "-1", "1.5", arrays and values
// that would overflow a Postgres integer column.
export const parseId = (value: unknown): number | null => {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= INT4_MAX ? id : null;
};

// Drizzle may wrap driver errors, so check both places
export const pgCode = (err: any): string | undefined =>
  err?.code ?? err?.cause?.code;

export const pgConstraint = (err: any): string | undefined =>
  err?.constraint ?? err?.cause?.constraint;
