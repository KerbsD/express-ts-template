import express from "express";
import { handlePublicDesigns } from "../../controllers/design/index.ts";
import { validatePublicDesignQuery } from "../../validators/design.ts";

const router = express.Router();

// Public: the /design page fetches this to render the design grid.
router.get("/", validatePublicDesignQuery, handlePublicDesigns);

export default router;
