import { eq, like, sql } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import { slugify } from "../../lib/slug.ts";
import type { CreateMerchInput } from "../../validators/merch.ts";

// req.body is already validated and trimmed by validateCreateMerch
const handleCreateMerch = async (req: Request, res: Response) => {
  const {
    name,
    price,
    imageUrl,
    slug,
    category,
    preorder,
    sortOrder,
    published,
  } = req.body as CreateMerchInput;

  let finalSlug: string;
  if (slug !== undefined) {
    // An explicit slug must be free: silently suffixing it would be surprising
    const [conflict] = await db
      .select({ id: merchProducts.id })
      .from(merchProducts)
      .where(eq(merchProducts.slug, slug))
      .limit(1);
    if (conflict)
      return res
        .status(409)
        .json({ success: false, message: "Slug is already in use." });
    finalSlug = slug;
  } else {
    // Generate one from the name, appending -2, -3, ... on collisions
    const base = slugify(name) || `product-${Date.now().toString(36)}`;
    const rows = await db
      .select({ slug: merchProducts.slug })
      .from(merchProducts)
      .where(like(merchProducts.slug, `${base}%`));
    const taken = new Set(rows.map((row) => row.slug));
    finalSlug = base;
    for (let suffix = 2; taken.has(finalSlug); suffix++)
      finalSlug = `${base}-${suffix}`;
  }

  // Append to the end of the grid unless the admin set an explicit order
  const [nextOrder] = await db
    .select({
      value: sql<number>`coalesce(max(${merchProducts.sortOrder}), -1)::int + 1`,
    })
    .from(merchProducts);

  const [product] = await db
    .insert(merchProducts)
    .values({
      name,
      slug: finalSlug,
      price,
      imageUrl,
      category,
      preorder: preorder ?? false,
      sortOrder: sortOrder ?? nextOrder.value,
      published: published ?? true,
    })
    .returning();

  res.status(201).json({ success: true, data: product });
};

export { handleCreateMerch };
