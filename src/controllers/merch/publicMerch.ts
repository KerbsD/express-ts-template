import { asc, eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import type { PublicMerchQuery } from "../../validators/merch.ts";

// Public: only published products, in display order. Paginated so a growing
// catalog can be loaded in chunks; the frontend filters categories client-side.
const handlePublicMerch = async (_req: Request, res: Response) => {
  // Placed here by validatePublicMerchQuery (req.query is read-only in Express 5)
  const { limit, offset } = res.locals.query as PublicMerchQuery;
  const published = eq(merchProducts.published, true);

  const [products, [count]] = await Promise.all([
    db
      .select()
      .from(merchProducts)
      .where(published)
      .orderBy(asc(merchProducts.sortOrder), asc(merchProducts.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(merchProducts)
      .where(published),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: {
      limit,
      offset,
      total: count.total,
      hasMore: offset + products.length < count.total,
    },
  });
};

export { handlePublicMerch };
