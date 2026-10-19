import { asc, eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";

// Public: only published items, in carousel order. No pagination — the public
// page renders the whole gallery in one go.
const handlePublicPortfolio = async (_req: Request, res: Response) => {
  const items = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.published, true))
    .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.id));

  res.json({ success: true, data: items });
};

export { handlePublicPortfolio };
