import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import type { ListDesignQuery } from "../../validators/design.ts";

const handleListDesigns = async (_req: Request, res: Response) => {
  // Placed here by validateListDesignQuery (req.query is read-only in Express 5)
  const { published, category, search, limit, offset, sort, order } =
    res.locals.query as ListDesignQuery;

  const filters: SQL[] = [];
  if (published !== undefined)
    filters.push(eq(designItems.published, published));
  if (category) filters.push(eq(designItems.category, category));
  if (search) {
    // Escape wildcards so the search term matches literally
    const term = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(ilike(designItems.title, term));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortColumns = {
    sortOrder: designItems.sortOrder,
    title: designItems.title,
    createdAt: designItems.createdAt,
  } as const;

  const sortColumn = sortColumns[sort];

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(designItems)
      .where(where)
      .orderBy(
        order === "asc" ? asc(sortColumn) : desc(sortColumn),
        asc(designItems.id), // stable tiebreak
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(designItems)
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

export { handleListDesigns };
