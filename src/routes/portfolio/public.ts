import express from "express";
import { handlePublicPortfolio } from "../../controllers/portfolio/index.ts";

const router = express.Router();

router.get("/", handlePublicPortfolio);

export default router;
