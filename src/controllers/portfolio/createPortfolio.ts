import { desc, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";
import type { CreatePortfolioInput } from "../../validators/portfolio.ts";

// req.body is already validated and trimmed by validateCreatePortfolio
const handleCreatePortfolio = async (req: Request, res: Response) => {
  const {
    title,
    description,
    imageUrl,
    style,
    artist,
    duration,
    date,
    sortOrder,
    published,
  } = req.body as CreatePortfolioInput;

  // Append to the end of the carousel unless the admin set an explicit order
  const [nextOrder] = await db
    .select({ value: sql<number>`coalesce(max(${portfolioItems.sortOrder}), -1)::int + 1` })
    .from(portfolioItems);

  const [item] = await db
    .insert(portfolioItems)
    .values({
      title,
      description,
      imageUrl,
      style,
      artist,
      duration,
      date: date ?? null,
      sortOrder: sortOrder ?? nextOrder.value,
      published: published ?? true,
    })
    .returning();

  res.status(201).json({ success: true, data: item });
};

export { handleCreatePortfolio };
