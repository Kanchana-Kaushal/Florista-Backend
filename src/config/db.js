import mongoose from 'mongoose';
import Flower from '../models/flower.model.js';
import Counter from '../models/counter.model.js';

const seedPackingFee = async () => {
  try {
    let existing = await Flower.findOne({ flowerId: "F024" });
    if (!existing) {
      existing = await Flower.findOne({ name: { $regex: /^packing fee$/i } });
    }

    if (!existing) {
      await Flower.create({
        flowerId: "F024",
        name: "Packing Fee",
        costPrice: 200,
        sellingPrice: 250,
      });
      console.log("Seeded Packing Fee (F024) - Cost: 200, Sell: 250");
    } else if (existing.flowerId !== "F024") {
      existing.flowerId = "F024";
      existing.costPrice = existing.costPrice ?? 200;
      existing.sellingPrice = existing.sellingPrice ?? 250;
      await existing.save();
      console.log("Updated Packing Fee ID to F024");
    }

    // Ensure Counter for flower does not conflict with F024 (24)
    await Counter.findByIdAndUpdate(
      "flower",
      { $max: { seq: 24 } },
      { upsert: true }
    );
  } catch (err) {
    console.error("Error seeding Packing Fee:", err.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/florista_erp');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await seedPackingFee();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

