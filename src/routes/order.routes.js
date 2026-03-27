import express from "express";
import { 
  createOrder, 
  getOrders, 
  getOrderById, 
  updateOrder, 
  deleteOrder 
} from "../controllers/order.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validator.middleware.js";

const router = express.Router();

router.use(protect);

const orderValidation = [
  body("buyer").optional().notEmpty().withMessage("Buyer is required"),
  body("items").optional().isArray({ min: 1 }).withMessage("At least one item is required"),
  body("items.*.cost").optional().isNumeric().isFloat({ min: 0 }),
  body("items.*.price").optional().isNumeric().isFloat({ min: 0 }),
  body("items.*.qty").optional().isNumeric().isInt({ min: 1 }),
  validateRequest
];

const orderCreateValidation = [
  body("buyer").notEmpty().withMessage("Buyer is required"),
  body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
  body("items.*.cost").isNumeric().isFloat({ min: 0 }),
  body("items.*.price").isNumeric().isFloat({ min: 0 }),
  body("items.*.qty").isNumeric().isInt({ min: 1 }),
  validateRequest
];

router.post("/", orderCreateValidation, createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.put("/:id", orderValidation, updateOrder);
router.delete("/:id", deleteOrder);

export default router;
