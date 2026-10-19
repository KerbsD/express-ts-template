import express from "express";
import {
  handleCreatePortfolio,
  handleDeletePortfolio,
  handleGetPortfolio,
  handleListPortfolio,
  handleUpdatePortfolio,
} from "../../controllers/portfolio/index.ts";
import {
  validateCreatePortfolio,
  validateListPortfolioQuery,
  validateUpdatePortfolio,
} from "../../validators/portfolio.ts";

const router = express.Router();

router.get("/", validateListPortfolioQuery, handleListPortfolio);
router.post("/", validateCreatePortfolio, handleCreatePortfolio);
router.get("/:id", handleGetPortfolio);
router.patch("/:id", validateUpdatePortfolio, handleUpdatePortfolio);
router.delete("/:id", handleDeletePortfolio);

export default router;
