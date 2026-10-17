import express from "express";
import { handleNewUser } from "../../controllers/auth/register.ts";
import { registerLimiter } from "../../lib/authLimiter.ts";

import { validateNewUser } from "../../validators/auth.ts";

const router = express.Router();

router.post("/", registerLimiter, validateNewUser, handleNewUser);

export default router;
