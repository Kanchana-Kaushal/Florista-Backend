import express from "express";
import { getDashboardStats } from "../controllers/stats.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Apply auth middleware to all stats routes
router.use(protect);

router.get("/", getDashboardStats);

export default router;
