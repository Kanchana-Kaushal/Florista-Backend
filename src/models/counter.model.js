import mongoose from "mongoose";

/**
 * Atomic counter — used for generating sequential IDs (O001, B001, F001).
 * findOneAndUpdate with $inc is a single atomic operation, eliminating
 * the race condition in the old "find last + increment" pre-save pattern.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String }, // e.g. "order", "buyer", "flower"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

/**
 * Get the next sequence value for a given counter name.
 * @param {string} name — "order" | "buyer" | "flower"
 * @returns {Promise<number>} the new sequence number
 */
export const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
};

export default Counter;
