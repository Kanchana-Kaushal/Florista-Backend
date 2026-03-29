import Order from "../models/order.model.js";

export const getDashboardStats = async (req, res) => {
  try {
    const monthOffset = parseInt(req.query.monthOffset || '0', 10);
    const now = new Date();
    
    // Target month start
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    // Target month end
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0, 23, 59, 59, 999);

    // 1. Monthly Overview (For the selected month)
    const monthlyStatsPipeline = [
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          totalCost: { $sum: { $multiply: ["$items.cost", "$items.qty"] } },
        }
      }
    ];

    const orderLevelStats = await Order.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, totalDiscount: { $sum: "$discount" } } }
    ]);
    const totalDiscount = orderLevelStats.length > 0 ? orderLevelStats[0].totalDiscount || 0 : 0;

    const statsResult = await Order.aggregate(monthlyStatsPipeline);
    const totalSales = statsResult.length > 0 ? statsResult[0].totalSales : 0;
    const totalCost = statsResult.length > 0 ? statsResult[0].totalCost : 0;
    const totalProfit = (totalSales - totalCost) - totalDiscount;

    const fulfilledOrders = await Order.countDocuments({ 
      date: { $gte: startOfMonth, $lte: endOfMonth }, 
      settled: true 
    });
    
    const unsettledStats = await Order.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth }, settled: false } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$totalAmount" } } }
    ]);
    const unsettledOrders = unsettledStats.length > 0 ? unsettledStats[0].count : 0;
    const unsettledValue = unsettledStats.length > 0 ? unsettledStats[0].value : 0;

    const unpaidStats = await Order.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth }, paid: false } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$totalAmount" } } }
    ]);
    const unpaidOrders = unpaidStats.length > 0 ? unpaidStats[0].count : 0;
    const unpaidValue = unpaidStats.length > 0 ? unpaidStats[0].value : 0;

    // 2. Top 5 Buyers (Lifetime buys)
    const topBuyersPipeline = [
      { $unwind: "$items" },
      {
        $group: {
          _id: { orderId: "$_id", buyer: "$buyer" },
          orderTotal: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
        }
      },
      {
        $group: {
          _id: "$_id.buyer",
          lifetimeSpent: { $sum: "$orderTotal" },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { lifetimeSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "buyers",
          localField: "_id",
          foreignField: "_id",
          as: "buyerInfo"
        }
      },
      { $unwind: "$buyerInfo" },
      {
        $project: {
          _id: 1,
          name: "$buyerInfo.name",
          businessName: "$buyerInfo.businessName",
          telephone: "$buyerInfo.telephone",
          location: "$buyerInfo.location",
          lifetimeSpent: 1,
          totalOrders: 1
        }
      }
    ];
    const topBuyers = await Order.aggregate(topBuyersPipeline);

    // 3. Top 5 Most Sold Flowers (For the selected month)
    const topFlowersPipeline = [
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $unwind: "$items" },
      { $match: { "items.flower": { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$items.flower",
          totalQtySold: { $sum: "$items.qty" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
        }
      },
      { $sort: { totalQtySold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "flowers",
          localField: "_id",
          foreignField: "_id",
          as: "flowerInfo"
        }
      },
      { $unwind: { path: "$flowerInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: "$flowerInfo.name",
          totalQtySold: 1,
          totalRevenue: 1
        }
      }
    ];
    const topFlowers = await Order.aggregate(topFlowersPipeline);

    // 4. Historical Monthly Averages (Lifetime)
    const averagesPipeline = [
      { $unwind: "$items" },
      {
        $group: {
          _id: { orderId: "$_id", year: { $year: "$date" }, month: { $month: "$date" } },
          orderSales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          orderCost: { $sum: { $multiply: ["$items.cost", "$items.qty"] } }
        }
      },
      {
        $group: {
          _id: { year: "$_id.year", month: "$_id.month" },
          monthlySales: { $sum: "$orderSales" },
          monthlyCost: { $sum: "$orderCost" },
          monthlyOrders: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          avgSalesPerMonth: { $avg: "$monthlySales" },
          avgCostPerMonth: { $avg: "$monthlyCost" },
          avgOrdersPerMonth: { $avg: "$monthlyOrders" }
        }
      }
    ];
    
    const averagesResult = await Order.aggregate(averagesPipeline);
    let historicalAverages = { avgSalesPerMonth: 0, avgCostPerMonth: 0, avgProfitPerMonth: 0, avgOrdersPerMonth: 0 };
    if (averagesResult.length > 0) {
      const resAvg = averagesResult[0];
      historicalAverages = {
        avgSalesPerMonth: resAvg.avgSalesPerMonth || 0,
        avgCostPerMonth: resAvg.avgCostPerMonth || 0,
        avgProfitPerMonth: (resAvg.avgSalesPerMonth || 0) - (resAvg.avgCostPerMonth || 0),
        avgOrdersPerMonth: resAvg.avgOrdersPerMonth || 0
      };
    }

    // 5. Sales By Location (For the selected month)
    const salesByLocationPipeline = [
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { orderId: "$_id", buyer: "$buyer" },
          orderSales: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
        }
      },
      {
        $lookup: {
          from: "buyers",
          localField: "_id.buyer",
          foreignField: "_id",
          as: "buyerInfo"
        }
      },
      { $unwind: "$buyerInfo" },
      {
        $group: {
          _id: "$buyerInfo.location",
          totalSales: { $sum: "$orderSales" },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } },
      {
        $project: {
          _id: 0,
          location: "$_id",
          totalSales: 1,
          totalOrders: 1
        }
      }
    ];
    const salesByLocation = await Order.aggregate(salesByLocationPipeline);

    // 6. Recent Activity Feed (Lifetime context)
    const recentOrdersQuery = await Order.find()
      .sort({ date: -1 })
      .limit(5)
      .populate("buyer", "name businessName")
      .lean();

    const recentActivity = recentOrdersQuery.map(o => ({
      orderId: o.orderId,
      buyerName: o.buyer ? (o.buyer.businessName || o.buyer.name) : "Unknown",
      date: o.date,
      paid: o.paid,
      settled: o.settled
    }));

    // 7. Top Debtors (Lifetime unpaid/unsettled)
    const topDebtorsPipeline = [
      { $match: { $or: [{ paid: false }, { settled: false }] } },
      {
        $group: {
          _id: "$buyer",
          totalOwed: { $sum: "$totalAmount" },
          debtOrdersCount: { $sum: 1 }
        }
      },
      { $sort: { totalOwed: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: "buyers",
          localField: "_id",
          foreignField: "_id",
          as: "buyerInfo"
        }
      },
      { $unwind: { path: "$buyerInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: "$buyerInfo.name",
          businessName: "$buyerInfo.businessName",
          telephone: "$buyerInfo.telephone",
          totalOwed: 1,
          debtOrdersCount: 1
        }
      }
    ];
    const topDebtors = await Order.aggregate(topDebtorsPipeline);

    // 8. Monthly Sales (Last 12 Months)
    const twelveMonthsAgo = new Date(endOfMonth.getFullYear(), endOfMonth.getMonth() - 11, 1);
    const monthlySalesPipeline = [
      { $match: { date: { $gte: twelveMonthsAgo, $lte: endOfMonth } } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          totalSales: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ];
    const monthlySalesRaw = await Order.aggregate(monthlySalesPipeline);
    const monthlySales = monthlySalesRaw.map(m => ({
      date: new Date(m._id.year, m._id.month - 1, 1).toISOString(),
      totalSales: m.totalSales
    }));

    res.status(200).json({
      timeframe: { startOfMonth, endOfMonth },
      overview: {
        totalSales,
        totalCost,
        totalProfit,
        totalDiscount,
        fulfilledOrders,
        unsettledOrders,
        unpaidOrders,
        unsettledValue,
        unpaidValue
      },
      historicalAverages,
      topBuyers,
      topFlowers,
      salesByLocation,
      recentActivity,
      topDebtors,
      monthlySales
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
