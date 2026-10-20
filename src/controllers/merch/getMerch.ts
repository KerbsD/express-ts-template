import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleGetMerch = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  const [product] = await db
    .select()
    .from(merchProducts)
    .where(eq(merchProducts.id, id))
    .limit(1);

  if (!product)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  res.json({ success: true, data: product });
};

export { handleGetMerch };
