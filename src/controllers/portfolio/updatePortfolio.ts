import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";
import type { UpdatePortfolioInput } from "../../validators/portfolio.ts";

const handleUpdatePortfolio = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  const body = req.body as UpdatePortfolioInput;

  // Only touch the fields that were actually sent (updatedAt is bumped by the
  // column's $onUpdate)
  const patch: Partial<typeof portfolioItems.$inferInsert> = {};
  
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
  if (body.style !== undefined) patch.style = body.style;
  if (body.artist !== undefined) patch.artist = body.artist;
  if (body.duration !== undefined) patch.duration = body.duration;
  if (body.date !== undefined) patch.date = body.date;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  if (body.published !== undefined) patch.published = body.published;

  const [item] = await db
    .update(portfolioItems)
    .set(patch)
    .where(eq(portfolioItems.id, id))
    .returning();

  if (!item)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  res.json({ success: true, data: item });
};

export { handleUpdatePortfolio };
