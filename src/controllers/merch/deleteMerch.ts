import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { merchProducts } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleDeleteMerch = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  const [deleted] = await db
    .delete(merchProducts)
    .where(eq(merchProducts.id, id))
    .returning({ id: merchProducts.id });

  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Merch product not found." });

  res.json({ success: true, message: "Merch product deleted." });
};

export { handleDeleteMerch };
