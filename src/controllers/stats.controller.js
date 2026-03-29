import Order from "../models/order.model.js";

export const getDashboardStats = async (req, res) => {
  try {
    const monthOffset = parseInt(req.query.monthOffset || "0", 10);
    const now = new Date();

    // ── Date ranges ───────────────────────────────────────────────────────────
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() - monthOffset,
      1,
    );
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() - monthOffset + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Previous month (for month-over-month comparison #12)
    const startOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - monthOffset - 1,
      1,
    );
    const endOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - monthOffset,
      0,
      23,
      59,
      59,
      999,
    );

    // ── #11: Single $facet pipeline for all monthly stats ────────────────────
    // This replaces ~6 separate aggregate calls with one DB roundtrip.
    const [monthlyFacetResult] = await Order.aggregate([
      // Pre-filter to only orders in the selected month (sent to all sub-pipelines)
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $facet: {
          // Overview: totals from order items
          itemStats: [
            { $unwind: "$items" },
            {
              $group: {
                _id: null,
                totalSales: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
                totalCost: {
                  $sum: { $multiply: ["$items.cost", "$items.qty"] },
                },
              },
            },
          ],

          // Discount total (order-level, not item-level)
          discountStats: [
            {
              $group: {
                _id: null,
                totalDiscount: { $sum: "$discount" },
              },
            },
          ],

          // Settlement counts
          settlementStats: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                fulfilledOrders: {
                  $sum: { $cond: ["$settled", 1, 0] },
                },
                unsettledCount: {
                  $sum: { $cond: [{ $eq: ["$settled", false] }, 1, 0] },
                },
                unsettledValue: {
                  $sum: {
                    $cond: [{ $eq: ["$settled", false] }, "$totalAmount", 0],
                  },
                },
                unpaidCount: {
                  $sum: { $cond: [{ $eq: ["$paid", false] }, 1, 0] },
                },
                unpaidValue: {
                  $sum: {
                    $cond: [{ $eq: ["$paid", false] }, "$totalAmount", 0],
                  },
                },
              },
            },
          ],

          // #14: Top flowers with profit margin data
          topFlowers: [
            { $unwind: "$items" },
            { $match: { "items.flower": { $exists: true, $ne: null } } },
            {
              $group: {
                _id: "$items.flower",
                totalQtySold: { $sum: "$items.qty" },
                totalRevenue: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
                totalCost: {
                  $sum: { $multiply: ["$items.cost", "$items.qty"] },
                },
              },
            },
            { $sort: { totalQtySold: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "flowers",
                localField: "_id",
                foreignField: "_id",
                as: "flowerInfo",
              },
            },
            {
              $unwind: {
                path: "$flowerInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                name: "$flowerInfo.name",
                totalQtySold: 1,
                totalRevenue: 1,
                totalCost: 1,
                // Gross profit for this flower this month
                grossProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
                // Profit margin percentage
                profitMarginPct: {
                  $cond: [
                    { $gt: ["$totalRevenue", 0] },
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: ["$totalRevenue", "$totalCost"] },
                            "$totalRevenue",
                          ],
                        },
                        100,
                      ],
                    },
                    0,
                  ],
                },
              },
            },
          ],

          // Sales by location
          salesByLocation: [
            { $unwind: "$items" },
            {
              $group: {
                _id: { orderId: "$_id", buyer: "$buyer" },
                orderSales: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
              },
            },
            {
              $lookup: {
                from: "buyers",
                localField: "_id.buyer",
                foreignField: "_id",
                as: "buyerInfo",
              },
            },
            { $unwind: "$buyerInfo" },
            {
              $group: {
                _id: "$buyerInfo.location",
                totalSales: { $sum: "$orderSales" },
                totalOrders: { $sum: 1 },
              },
            },
            { $sort: { totalSales: -1 } },
            {
              $project: {
                _id: 0,
                location: "$_id",
                totalSales: 1,
                totalOrders: 1,
              },
            },
          ],
        },
      },
    ]);

    // ── #12: Previous month totals for MoM comparison ────────────────────────
    const [prevMonthFacetResult] = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
        },
      },
      {
        $facet: {
          itemStats: [
            { $unwind: "$items" },
            {
              $group: {
                _id: null,
                totalSales: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
                totalCost: {
                  $sum: { $multiply: ["$items.cost", "$items.qty"] },
                },
              },
            },
          ],
          discountStats: [
            { $group: { _id: null, totalDiscount: { $sum: "$discount" } } },
          ],
          orderCount: [{ $count: "count" }],
        },
      },
    ]);

    // ── #11: Lifetime stats (topBuyers, averages, debtors, chart) ─────────────
    const [lifetimeFacetResult] = await Order.aggregate([
      {
        $facet: {
          // Top 5 buyers by lifetime revenue
          topBuyers: [
            { $unwind: "$items" },
            {
              $group: {
                _id: { orderId: "$_id", buyer: "$buyer" },
                orderTotal: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
              },
            },
            {
              $group: {
                _id: "$_id.buyer",
                lifetimeSpent: { $sum: "$orderTotal" },
                totalOrders: { $sum: 1 },
              },
            },
            { $sort: { lifetimeSpent: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "buyers",
                localField: "_id",
                foreignField: "_id",
                as: "buyerInfo",
              },
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
                totalOrders: 1,
              },
            },
          ],

          // Historical averages per month
          historicalAverages: [
            { $unwind: "$items" },
            {
              $group: {
                _id: {
                  orderId: "$_id",
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                orderSales: {
                  $sum: { $multiply: ["$items.price", "$items.qty"] },
                },
                orderCost: {
                  $sum: { $multiply: ["$items.cost", "$items.qty"] },
                },
              },
            },
            {
              $group: {
                _id: { year: "$_id.year", month: "$_id.month" },
                monthlySales: { $sum: "$orderSales" },
                monthlyCost: { $sum: "$orderCost" },
                monthlyOrders: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: null,
                avgSalesPerMonth: { $avg: "$monthlySales" },
                avgCostPerMonth: { $avg: "$monthlyCost" },
                avgOrdersPerMonth: { $avg: "$monthlyOrders" },
              },
            },
          ],

          // Outstanding debtors (unpaid OR unsettled)
          topDebtors: [
            { $match: { $or: [{ paid: false }, { settled: false }] } },
            {
              $group: {
                _id: "$buyer",
                totalOwed: { $sum: "$totalAmount" },
                debtOrdersCount: { $sum: 1 },
              },
            },
            { $sort: { totalOwed: -1 } },
            { $limit: 6 },
            {
              $lookup: {
                from: "buyers",
                localField: "_id",
                foreignField: "_id",
                as: "buyerInfo",
              },
            },
            {
              $unwind: {
                path: "$buyerInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                name: "$buyerInfo.name",
                businessName: "$buyerInfo.businessName",
                telephone: "$buyerInfo.telephone",
                totalOwed: 1,
                debtOrdersCount: 1,
              },
            },
          ],

          // Last 12 months revenue chart
          monthlySalesChart: [
            {
              $group: {
                _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                totalSales: { $sum: "$totalAmount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    // ── Recent activity (simple find — no aggregation needed) ─────────────────
    const recentOrdersQuery = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("buyer", "name businessName")
      .lean();

    const recentActivity = recentOrdersQuery.map((o) => ({
      orderId: o.orderId,
      buyerName: o.buyer
        ? o.buyer.businessName || o.buyer.name
        : "Unknown",
      date: o.createdAt,
      paid: o.paid,
      settled: o.settled,
    }));

    // ── Assemble current-month overview ──────────────────────────────────────
    const itemStats = monthlyFacetResult.itemStats[0] || {};
    const discountStats = monthlyFacetResult.discountStats[0] || {};
    const settlementStats = monthlyFacetResult.settlementStats[0] || {};

    const totalSales = itemStats.totalSales || 0;
    const totalCost = itemStats.totalCost || 0;
    const totalDiscount = discountStats.totalDiscount || 0;
    const totalProfit = totalSales - totalCost - totalDiscount;

    // ── Assemble previous-month overview (for MoM #12) ───────────────────────
    const prevItemStats = prevMonthFacetResult.itemStats[0] || {};
    const prevDiscountStats = prevMonthFacetResult.discountStats[0] || {};
    const prevTotalSales = prevItemStats.totalSales || 0;
    const prevTotalCost = prevItemStats.totalCost || 0;
    const prevTotalDiscount = prevDiscountStats.totalDiscount || 0;
    const prevTotalProfit = prevTotalSales - prevTotalCost - prevTotalDiscount;
    const prevOrderCount =
      prevMonthFacetResult.orderCount[0]?.count || 0;

    // ── Historical averages ───────────────────────────────────────────────────
    const avgRaw = lifetimeFacetResult.historicalAverages[0] || {};
    const historicalAverages = {
      avgSalesPerMonth: avgRaw.avgSalesPerMonth || 0,
      avgCostPerMonth: avgRaw.avgCostPerMonth || 0,
      avgProfitPerMonth:
        (avgRaw.avgSalesPerMonth || 0) - (avgRaw.avgCostPerMonth || 0),
      avgOrdersPerMonth: avgRaw.avgOrdersPerMonth || 0,
    };

    // ── Monthly chart data ────────────────────────────────────────────────────
    const monthlySales = lifetimeFacetResult.monthlySalesChart.map((m) => ({
      date: new Date(m._id.year, m._id.month - 1, 1).toISOString(),
      totalSales: m.totalSales,
    }));

    res.status(200).json({
      timeframe: { startOfMonth, endOfMonth },

      overview: {
        totalSales,
        totalCost,
        totalProfit,
        totalDiscount,
        fulfilledOrders: settlementStats.fulfilledOrders || 0,
        unsettledOrders: settlementStats.unsettledCount || 0,
        unpaidOrders: settlementStats.unpaidCount || 0,
        unsettledValue: settlementStats.unsettledValue || 0,
        unpaidValue: settlementStats.unpaidValue || 0,
      },

      // #12: Previous month for MoM comparison
      previousMonth: {
        totalSales: prevTotalSales,
        totalProfit: prevTotalProfit,
        totalOrders: prevOrderCount,
      },

      historicalAverages,
      topBuyers: lifetimeFacetResult.topBuyers,

      // #14: topFlowers now includes grossProfit & profitMarginPct
      topFlowers: monthlyFacetResult.topFlowers,

      salesByLocation: monthlyFacetResult.salesByLocation,
      recentActivity,
      topDebtors: lifetimeFacetResult.topDebtors,
      monthlySales,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
};
