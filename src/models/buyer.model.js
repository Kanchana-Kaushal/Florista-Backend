import mongoose from 'mongoose';

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

// Pre-save hook to auto generate buyerId like B001, B002
buyerSchema.pre('save', async function () {
  if (!this.buyerId) {
    const lastBuyer = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    if (lastBuyer && lastBuyer.buyerId && lastBuyer.buyerId.startsWith('B')) {
      const lastIdNumber = parseInt(lastBuyer.buyerId.substring(1), 10);
      this.buyerId = `B${(lastIdNumber + 1).toString().padStart(3, '0')}`;
    } else {
      this.buyerId = 'B001';
    }
  }
});

const Buyer = mongoose.model('Buyer', buyerSchema);
export default Buyer;
