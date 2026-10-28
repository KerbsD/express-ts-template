import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../../db/index.ts";
import { designItems } from "../../db/schema.ts";
import { parseId } from "../../lib/helpers.ts";

const handleGetDesign = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  const [design] = await db
    .select()
    .from(designItems)
    .where(eq(designItems.id, id))
    .limit(1);

  if (!design)
    return res
      .status(404)
      .json({ success: false, message: "Design not found." });

  res.json({ success: true, data: design });
};

export { handleGetDesign };
