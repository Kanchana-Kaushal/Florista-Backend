import Buyer from '../models/buyer.model.js';

// Create a new buyer
export const createBuyer = async (req, res) => {
  try {
    const buyer = new Buyer(req.body);
    const savedBuyer = await buyer.save();
    res.status(201).json(savedBuyer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all buyers with optional search and pagination
export const getBuyers = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      // Search by buyerId, name, telephone, or location (case-insensitive)
      query = {
        $or: [
          { buyerId: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { telephone: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const total = await Buyer.countDocuments(query);
    const buyers = await Buyer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: buyers,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single buyer by MongoDB _id or buyerId
export const getBuyerById = async (req, res) => {
  try {
    const { id } = req.params;
    let buyer = null;
    
    // Check if id is a valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      buyer = await Buyer.findById(id);
    }
    
    // If not found by ObjectId, try to find by custom buyerId
    if (!buyer) {
      buyer = await Buyer.findOne({ buyerId: id });
    }

    if (!buyer) return res.status(404).json({ error: 'Buyer not found' });

    res.status(200).json(buyer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update buyer by _id or buyerId
export const updateBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    let buyer = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      buyer = await Buyer.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    }

    if (!buyer) {
      buyer = await Buyer.findOneAndUpdate({ buyerId: id }, req.body, { new: true, runValidators: true });
    }

    if (!buyer) return res.status(404).json({ error: 'Buyer not found' });

    res.status(200).json(buyer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete buyer by _id or buyerId
export const deleteBuyer = async (req, res) => {
  try {
    const { id } = req.params;
    let buyer = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      buyer = await Buyer.findByIdAndDelete(id);
    }

    if (!buyer) {
      buyer = await Buyer.findOneAndDelete({ buyerId: id });
    }

    if (!buyer) return res.status(404).json({ error: 'Buyer not found' });

    res.status(200).json({ message: 'Buyer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
