import { and, eq, ne } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";
import type { UpdateMerchInput } from "../../validators/merch.ts";

const handleUpdateMerch = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  const body = req.body as UpdateMerchInput;

  // Only touch the fields that were actually sent (updatedAt is bumped by the
  // column's $onUpdate)
  const patch: Partial<typeof merchProducts.$inferInsert> = {};

  if (body.name !== undefined) patch.name = body.name;
  if (body.price !== undefined) patch.price = body.price;
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
  if (body.category !== undefined) patch.category = body.category;
  if (body.preorder !== undefined) patch.preorder = body.preorder;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
  if (body.published !== undefined) patch.published = body.published;

  // Renaming a product keeps its existing slug (stable links). A slug sent by
  // the admin must not belong to another product.
  if (body.slug !== undefined) {
    const [conflict] = await db
      .select({ id: merchProducts.id })
      .from(merchProducts)
      .where(and(eq(merchProducts.slug, body.slug), ne(merchProducts.id, id)))
      .limit(1);
    if (conflict)
      return res
        .status(409)
        .json({ success: false, message: "Slug is already in use." });
    patch.slug = body.slug;
  }

  const [product] = await db
    .update(merchProducts)
    .set(patch)
    .where(eq(merchProducts.id, id))
    .returning();

  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  res.json({ success: true, data: product });
};

export { handleUpdateMerch };
