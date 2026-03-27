import express from "express";
import cors from "cors";
import buyerRoutes from "./routes/buyer.routes.js";
import flowerRoutes from "./routes/flower.routes.js";
import orderRoutes from "./routes/order.routes.js";
import authRoutes from "./routes/auth.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import rateLimit from "express-rate-limit";

const app = express();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window`
  message: { error: "Too many requests from this IP, please try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Route
app.get("/", (req, res) => {
    res.send("Florista ERP Backend is running...");
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/buyers", buyerRoutes);
app.use("/api/flowers", flowerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stats", statsRoutes);

export default app;
