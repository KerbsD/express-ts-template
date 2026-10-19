import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { portfolioItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleDeletePortfolio = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  const [deleted] = await db
    .delete(portfolioItems)
    .where(eq(portfolioItems.id, id))
    .returning({ id: portfolioItems.id });

  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Portfolio item not found." });

  res.json({ success: true, message: "Portfolio item deleted." });
};

export { handleDeletePortfolio };
