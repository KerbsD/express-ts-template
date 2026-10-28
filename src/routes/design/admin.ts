import express from "express";
import {
  handleCreateDesign,
  handleDeleteDesign,
  handleGetDesign,
  handleListDesigns,
  handleUpdateDesign,
} from "../../controllers/design/index.ts";
import {
  validateCreateDesign,
  validateListDesignQuery,
  validateUpdateDesign,
} from "../../validators/design.ts";

const router = express.Router();

// Mounted below verifyJwt in server.ts: every handler here needs a valid access
// token. (Add a role check here when you introduce admin roles.)
router.get("/", validateListDesignQuery, handleListDesigns);
router.post("/", validateCreateDesign, handleCreateDesign);
router.get("/:id", handleGetDesign);
router.patch("/:id", validateUpdateDesign, handleUpdateDesign);
router.delete("/:id", handleDeleteDesign);

export default router;
