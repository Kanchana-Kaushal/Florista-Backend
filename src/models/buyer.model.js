import mongoose from 'mongoose';
import { getNextSequence } from './counter.model.js';

const buyerSchema = new mongoose.Schema(
  {
    buyerId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Buyer name is required'],
      trim: true,
    },
    telephone: {
      type: String,
      required: [true, 'Telephone is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    businessName: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Atomic sequential ID (fixes race condition) ──────────────────────────────
buyerSchema.pre('save', async function () {
  if (!this.buyerId) {
    const seq = await getNextSequence('buyer');
    this.buyerId = `B${seq.toString().padStart(3, '0')}`;
  }
});

const Buyer = mongoose.model('Buyer', buyerSchema);
export default Buyer;
