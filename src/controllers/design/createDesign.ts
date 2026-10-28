import { sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import type { CreateDesignInput } from "../../validators/design.ts";

// req.body is already validated and trimmed by validateCreateDesign
const handleCreateDesign = async (req: Request, res: Response) => {
  const {
    title,
    description,
    style,
    placement,
    imageUrl,
    category,
    sortOrder,
    published,
  } = req.body as CreateDesignInput;

  // Append to the end of the grid unless the admin set an explicit order
  const [nextOrder] = await db
    .select({
      value: sql<number>`coalesce(max(${designItems.sortOrder}), -1)::int + 1`,
    })
    .from(designItems);

  const [design] = await db
    .insert(designItems)
    .values({
      title,
      description,
      style,
      placement,
      imageUrl,
      category,
      sortOrder: sortOrder ?? nextOrder.value,
      published: published ?? true,
    })
    .returning();

  res.status(201).json({ success: true, data: design });
};

export { handleCreateDesign };
