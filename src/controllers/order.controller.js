import Order from "../models/order.model.js";
import Buyer from "../models/buyer.model.js";

// Create a new order
export const createOrder = async (req, res) => {
  try {
    const order = new Order(req.body);
    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all orders with pagination and populated buyer/flower details
export const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    let query = {};

    // Filter by payment status
    if (req.query.paid !== undefined && req.query.paid !== '') {
      query.paid = req.query.paid === 'true';
    }

    // Filter by settlement status
    if (req.query.settled !== undefined && req.query.settled !== '') {
      query.settled = req.query.settled === 'true';
    }

    // Filter by specific buyer ObjectId (#8 — buyer order history)
    if (req.query.buyerObjectId) {
      query.buyer = req.query.buyerObjectId;
    }

    // Text search across orderId and buyer name/businessName
    if (req.query.search) {
      const matchingBuyers = await Buyer.find({
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { businessName: { $regex: req.query.search, $options: 'i' } }
        ]
      }).select('_id');

      const buyerIds = matchingBuyers.map(b => b._id);

      query.$or = [
        { orderId: { $regex: req.query.search, $options: 'i' } },
        { buyer: { $in: buyerIds } }
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("buyer")
      .populate("items.flower")
      .sort({ paid: 1, settled: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      data: orders,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single order by MongoDB _id or orderId
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { orderId: id };
    }

    const order = await Order.findOne(query)
      .populate("buyer")
      .populate("items.flower");

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update order by MongoDB _id or orderId
// Automatically stamps paidDate and settledDate when those flags first become true
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { orderId: id };
    }

    // Fetch current state so we can decide whether to stamp timestamps
    const existing = await Order.findOne(query);
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const updateBody = { ...req.body };

    // Stamp paidDate only when transitioning from unpaid → paid (#2)
    if (updateBody.paid === true && !existing.paid) {
      updateBody.paidDate = new Date();
    }

    // Stamp settledDate only when transitioning from unsettled → settled (#2)
    if (updateBody.settled === true && !existing.settled) {
      updateBody.settledDate = new Date();
    }

    const order = await Order.findOneAndUpdate(query, updateBody, {
      new: true,
      runValidators: true,
    })
      .populate("buyer")
      .populate("items.flower");

    res.status(200).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete order by MongoDB _id or orderId
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      query = { orderId: id };
    }

    const order = await Order.findOneAndDelete(query);

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
