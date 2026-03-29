import mongoose from "mongoose";
import { getNextSequence } from "./counter.model.js";

const flowerSchema = new mongoose.Schema(
  {
    flowerId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Flower name is required"],
      trim: true,
    },
    costPrice: {
      type: Number,
      required: [true, "Cost price is required"],
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Atomic sequential ID (fixes race condition) ──────────────────────────────
flowerSchema.pre("save", async function () {
  if (!this.flowerId) {
    const seq = await getNextSequence("flower");
    this.flowerId = `F${seq.toString().padStart(3, "0")}`;
  }
});

const Flower = mongoose.model("Flower", flowerSchema);
export default Flower;
