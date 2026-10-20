import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import type { ListMerchQuery } from "../../validators/merch.ts";

const handleListMerch = async (_req: Request, res: Response) => {
  // Placed here by validateListMerchQuery (req.query is read-only in Express 5)
  const { published, preorder, category, search, limit, offset, sort, order } =
    res.locals.query as ListMerchQuery;

  const filters: SQL[] = [];

  if (published !== undefined)
    filters.push(eq(merchProducts.published, published));
  if (preorder !== undefined)
    filters.push(eq(merchProducts.preorder, preorder));
  if (category) filters.push(eq(merchProducts.category, category));
  if (search) {
    // Escape wildcards so the search term matches literally
    const term = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(ilike(merchProducts.name, term));
  }
  
  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortColumns = {
    sortOrder: merchProducts.sortOrder,
    name: merchProducts.name,
    price: merchProducts.price,
    createdAt: merchProducts.createdAt,
  } as const;

  const sortColumn = sortColumns[sort];

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(merchProducts)
      .where(where)
      .orderBy(
        order === "asc" ? asc(sortColumn) : desc(sortColumn),
        asc(merchProducts.id), // stable tiebreak
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(merchProducts)
      .where(where),
  ]);

  res.json({
    success: true,
    data: rows,
    pagination: {
      limit,
      offset,
      total: count.total,
      hasMore: offset + rows.length < count.total,
    },
  });
};

export { handleListMerch };
