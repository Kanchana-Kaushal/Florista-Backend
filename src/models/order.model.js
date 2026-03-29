import mongoose from "mongoose";
import { getNextSequence } from "./counter.model.js";

const orderItemSchema = new mongoose.Schema({
  flower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Flower",
  },
  customProduct: {
    type: String,
    trim: true,
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  qty: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: [true, "Buyer is required"],
    },
    items: [orderItemSchema],
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    // Timestamp set automatically when paid is first set to true
    paidDate: {
      type: Date,
      default: null,
    },
    settled: {
      type: Boolean,
      default: false,
    },
    // Timestamp set automatically when settled is first set to true
    settledDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // provides createdAt + updatedAt — use createdAt as the order date
  },
);

// ── Indexes for fast aggregation queries ──────────────────────────────────────
orderSchema.index({ createdAt: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ buyer: 1 });
orderSchema.index({ paid: 1, settled: 1 });
orderSchema.index({ settled: 1 });

// ── Atomic sequential ID (fixes race condition) ───────────────────────────────
orderSchema.pre("save", async function () {
  if (!this.orderId) {
    const seq = await getNextSequence("order");
    this.orderId = `O${seq.toString().padStart(3, "0")}`;
  }
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
