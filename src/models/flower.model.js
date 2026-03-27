import mongoose from "mongoose";

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

// Pre-save hook to auto generate flowerId like F001, F002
flowerSchema.pre("save", async function () {
  if (!this.flowerId) {
    const lastFlower = await this.constructor.findOne({}, {}, { sort: { "createdAt": -1 } });
    if (lastFlower && lastFlower.flowerId && lastFlower.flowerId.startsWith("F")) {
      const lastIdNumber = parseInt(lastFlower.flowerId.substring(1), 10);
      this.flowerId = `F${(lastIdNumber + 1).toString().padStart(3, "0")}`;
    } else {
      this.flowerId = "F001";
    }
  }
});

const Flower = mongoose.model("Flower", flowerSchema);
export default Flower;
