import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleDeleteDesign = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  const [deleted] = await db
    .delete(designItems)
    .where(eq(designItems.id, id))
    .returning({ id: designItems.id });

  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  res.json({ success: true, message: "Design deleted." });
};

export { handleDeleteDesign };
