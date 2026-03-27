import Flower from "../models/flower.model.js";

// Create a new flower
export const createFlower = async (req, res) => {
  try {
    const flower = new Flower(req.body);
    const savedFlower = await flower.save();
    res.status(201).json(savedFlower);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all flowers with optional name search and pagination
export const getFlowers = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      // Search by flower name (case-insensitive)
      query = { name: { $regex: search, $options: "i" } };
    }

    const total = await Flower.countDocuments(query);
    const flowers = await Flower.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: flowers,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single flower by MongoDB _id or flowerId
export const getFlowerById = async (req, res) => {
  try {
    const { id } = req.params;
    let flower = null;

    // Check if id is a valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      flower = await Flower.findById(id);
    }

    // If not found by ObjectId, try to find by custom flowerId
    if (!flower) {
      flower = await Flower.findOne({ flowerId: id });
    }

    if (!flower) return res.status(404).json({ error: "Flower not found" });

    res.status(200).json(flower);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update flower by _id or flowerId
export const updateFlower = async (req, res) => {
  try {
    const { id } = req.params;
    let flower = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      flower = await Flower.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    }

    if (!flower) {
      flower = await Flower.findOneAndUpdate({ flowerId: id }, req.body, { new: true, runValidators: true });
    }

    if (!flower) return res.status(404).json({ error: "Flower not found" });

    res.status(200).json(flower);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete flower by _id or flowerId
export const deleteFlower = async (req, res) => {
  try {
    const { id } = req.params;
    let flower = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      flower = await Flower.findByIdAndDelete(id);
    }

    if (!flower) {
      flower = await Flower.findOneAndDelete({ flowerId: id });
    }

    if (!flower) return res.status(404).json({ error: "Flower not found" });

    res.status(200).json({ message: "Flower deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
