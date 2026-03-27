import mongoose from "mongoose";

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
  }
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
    date: {
      type: Date,
      default: Date.now,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    settled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to auto generate orderId like O001, O002
orderSchema.pre("save", async function () {
  if (!this.orderId) {
    const lastOrder = await this.constructor.findOne({}, {}, { sort: { "createdAt": -1 } });
    if (lastOrder && lastOrder.orderId && lastOrder.orderId.startsWith("O")) {
      const lastIdNumber = parseInt(lastOrder.orderId.substring(1), 10);
      this.orderId = `O${(lastIdNumber + 1).toString().padStart(3, "0")}`;
    } else {
      this.orderId = "O001";
    }
  }
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
