import express from "express";
import {
  handleCreateMerch,
  handleDeleteMerch,
  handleGetMerch,
  handleListMerch,
  handleUpdateMerch,
} from "../../controllers/merch/index.ts";
import {
  validateCreateMerch,
  validateListMerchQuery,
  validateUpdateMerch,
} from "../../validators/merch.ts";

const router = express.Router();

// Mounted below verifyJwt in server.ts: every handler here needs a valid access
// token. (Add a role check here when you introduce admin roles.)
router.get("/", validateListMerchQuery, handleListMerch);
router.post("/", validateCreateMerch, handleCreateMerch);
router.get("/:id", handleGetMerch);
router.patch("/:id", validateUpdateMerch, handleUpdateMerch);
router.delete("/:id", handleDeleteMerch);

export default router;
