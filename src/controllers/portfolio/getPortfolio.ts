import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleGetPortfolio = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  const [item] = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.id, id))
    .limit(1);

  if (!item)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  res.json({ success: true, data: item });
};

export { handleGetPortfolio };
