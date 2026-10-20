import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";
import type { UpdateDesignInput } from "../../validators/design.ts";

const handleUpdateDesign = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  const body = req.body as UpdateDesignInput;

  // Only touch the fields that were actually sent (updatedAt is bumped by the
  // column's $onUpdate)
  const patch: Partial<typeof designItems.$inferInsert> = {};
  
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.style !== undefined) patch.style = body.style;
  if (body.placement !== undefined) patch.placement = body.placement;
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
  if (body.category !== undefined) patch.category = body.category;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  if (body.published !== undefined) patch.published = body.published;

  const [design] = await db
    .update(designItems)
    .set(patch)
    .where(eq(designItems.id, id))
    .returning();

  if (!design)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  res.json({ success: true, data: design });
};

export { handleUpdateDesign };
