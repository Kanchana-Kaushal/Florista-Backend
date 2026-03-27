import express from "express";
import { 
  createFlower, 
  getFlowers, 
  getFlowerById, 
  updateFlower, 
  deleteFlower 
} from "../controllers/flower.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validator.middleware.js";

const router = express.Router();

router.use(protect);

const flowerValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("costPrice").optional().isNumeric().withMessage("Cost price must be a number").isFloat({ min: 0 }),
  body("sellingPrice").optional().isNumeric().withMessage("Selling price must be a number").isFloat({ min: 0 }),
  validateRequest
];

const flowerCreateValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("costPrice").isNumeric().withMessage("Cost price must be a numeric value").isFloat({ min: 0 }),
  body("sellingPrice").isNumeric().withMessage("Selling price must be a numeric value").isFloat({ min: 0 }),
  validateRequest
];

router.post("/", flowerCreateValidation, createFlower);
router.get("/", getFlowers);
router.get("/:id", getFlowerById);
router.put("/:id", flowerValidation, updateFlower);
router.delete("/:id", deleteFlower);

export default router;
