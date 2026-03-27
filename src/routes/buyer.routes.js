import express from "express";
import { 
  createBuyer, 
  getBuyers, 
  getBuyerById, 
  updateBuyer, 
  deleteBuyer 
} from "../controllers/buyer.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validator.middleware.js";

const router = express.Router();

router.use(protect);

const buyerValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("telephone").optional().trim().notEmpty().withMessage("Telephone cannot be empty"),
  body("location").optional().trim().notEmpty().withMessage("Location cannot be empty"),
  validateRequest
];

const buyerCreateValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("telephone").trim().notEmpty().withMessage("Telephone is required"),
  body("location").trim().notEmpty().withMessage("Location is required"),
  validateRequest
];

router.post("/", buyerCreateValidation, createBuyer);
router.get("/", getBuyers);
router.get("/:id", getBuyerById);
router.put("/:id", buyerValidation, updateBuyer);
router.delete("/:id", deleteBuyer);

export default router;
