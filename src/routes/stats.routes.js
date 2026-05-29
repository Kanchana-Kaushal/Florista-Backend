import express from "express";
import { getDashboardStats, getFlowerSalesStats } from "../controllers/stats.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Apply auth middleware to all stats routes
router.use(protect);

router.get("/", getDashboardStats);
router.get("/flower-sales", getFlowerSalesStats);

export default router;
