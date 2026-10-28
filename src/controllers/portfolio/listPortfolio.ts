import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";
import type { ListPortfolioQuery } from "../../validators/portfolio.ts";

const handleListPortfolio = async (_req: Request, res: Response) => {
  // Placed here by validateListPortfolioQuery (req.query is read-only in Express 5)
  const { published, style, search, limit, offset, sort, order } =
    res.locals.query as ListPortfolioQuery;

  const filters: SQL[] = [];
  if (published !== undefined)
    filters.push(eq(portfolioItems.published, published));
  if (style) filters.push(eq(portfolioItems.style, style));
  if (search) {
    // Escape wildcards so the search term matches literally
    const term = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(ilike(portfolioItems.title, term));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortColumns = {
    sortOrder: portfolioItems.sortOrder,
    date: portfolioItems.date,
    createdAt: portfolioItems.createdAt,
    title: portfolioItems.title,
  } as const;
  
  const sortColumn = sortColumns[sort];

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(portfolioItems)
      .where(where)
      .orderBy(
        order === "asc" ? asc(sortColumn) : desc(sortColumn),
        asc(portfolioItems.id), // stable tiebreak
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(portfolioItems)
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

export { handleListPortfolio };
