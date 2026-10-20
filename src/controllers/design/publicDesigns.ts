import { asc, eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import type { PublicDesignQuery } from "../../validators/design.ts";

// Public: only published designs, in display order. Paginated like /merch so a
// growing catalog can be loaded in chunks; filtering stays client-side.
const handlePublicDesigns = async (_req: Request, res: Response) => {
  // Placed here by validatePublicDesignQuery (req.query is read-only in Express 5)
  const { limit, offset } = res.locals.query as PublicDesignQuery;
  const published = eq(designItems.published, true);

  const [items, [count]] = await Promise.all([
    db
      .select()
      .from(designItems)
      .where(published)
      .orderBy(asc(designItems.sortOrder), asc(designItems.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(designItems)
      .where(published),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      limit,
      offset,
      total: count.total,
      hasMore: offset + items.length < count.total,
    },
  });
};

export { handlePublicDesigns };
