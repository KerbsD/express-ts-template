import express from "express";
import { handlePublicMerch } from "../../controllers/merch/index.ts";
import { validatePublicMerchQuery } from "../../validators/merch.ts";

const router = express.Router();

// Public: the /merch page fetches this to render the product grid.
router.get("/", validatePublicMerchQuery, handlePublicMerch);

export default router;
