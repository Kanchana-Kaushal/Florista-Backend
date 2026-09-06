import Order from "../models/order.model.js";
import Flower from "../models/flower.model.js";

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

          // Daily Activity Heatmap
          dailyActivity: [
            {
              $group: {
                _id: { day: { $dayOfMonth: "$createdAt" } },
                dailyAmount: { $sum: "$totalAmount" },
              },
            },
            { $sort: { "_id.day": 1 } },
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

          // Outstanding debtors (unpaid only)
          topDebtors: [
            { $match: { paid: false } },
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
      dailyActivity: monthlyFacetResult.dailyActivity.map(d => ({ day: d._id.day, amount: d.dailyAmount })),
      recentActivity,
      topDebtors: lifetimeFacetResult.topDebtors,
      monthlySales,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getFlowerSalesStats = async (req, res) => {
  try {
    // 1. Fetch all flowers in inventory
    const allFlowers = await Flower.find().lean();
    
    // 2. Perform aggregation grouped by flower and year/month
    const salesGroup = await Order.aggregate([
      // Unwind items array
      { $unwind: "$items" },
      // Match items that are standard flowers (ref to Flower exists)
      { $match: { "items.flower": { $exists: true, $ne: null } } },
      // Group by flower, year, month
      {
        $group: {
          _id: {
            flower: "$items.flower",
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          qtySold: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          cost: { $sum: { $multiply: ["$items.cost", "$items.qty"] } }
        }
      }
    ]);

    // 3. Generate last 12 calendar months list (from this month backwards)
    const monthsList = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-indexed
      const lastDay = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31
      const monthName = d.toLocaleString("default", { month: "short" });
      const fullMonthName = d.toLocaleString("default", { month: "long" });

      const label = `${fullMonthName} ${year}`;
      const rangeLabel = `${monthName} 1 – ${monthName} ${lastDay}`;

      monthsList.push({
        year,
        month,
        label,
        rangeLabel,
        key: `${year}-${month}`
      });
    }

    // 4. Map aggregation results into flowers Map
    const salesMap = {};
    salesGroup.forEach(item => {
      const flowerId = item._id.flower.toString();
      const year = item._id.year;
      const month = item._id.month;
      const key = `${year}-${month}`;

      if (!salesMap[flowerId]) {
        salesMap[flowerId] = {
          allTime: { qty: 0, revenue: 0, profit: 0 },
          monthly: {}
        };
        monthsList.forEach(m => {
          salesMap[flowerId].monthly[m.key] = { qty: 0, revenue: 0, profit: 0 };
        });
      }

      const itemProfit = item.revenue - item.cost;

      // Accumulate all-time (lifetime) sales
      salesMap[flowerId].allTime.qty += item.qtySold;
      salesMap[flowerId].allTime.revenue += item.revenue;
      salesMap[flowerId].allTime.profit += itemProfit;

      // Accumulate monthly sales if within the last 12 months
      if (salesMap[flowerId].monthly[key] !== undefined) {
        salesMap[flowerId].monthly[key].qty = item.qtySold;
        salesMap[flowerId].monthly[key].revenue = item.revenue;
        salesMap[flowerId].monthly[key].profit = itemProfit;
      }
    });

    // 5. Build final payload by merging allFlowers with their sales statistics
    const flowerSales = allFlowers.map(flower => {
      const idStr = flower._id.toString();
      const stats = salesMap[idStr] || {
        allTime: { qty: 0, revenue: 0, profit: 0 },
        monthly: {}
      };

      // Ensure empty months are fully filled with 0s
      if (Object.keys(stats.monthly).length === 0) {
        monthsList.forEach(m => {
          stats.monthly[m.key] = { qty: 0, revenue: 0, profit: 0 };
        });
      }

      return {
        _id: flower._id,
        flowerId: flower.flowerId,
        name: flower.name,
        costPrice: flower.costPrice,
        sellingPrice: flower.sellingPrice,
        allTime: stats.allTime,
        monthly: stats.monthly
      };
    });

    res.status(200).json({
      monthsList,
      flowerSales
    });
  } catch (error) {
    console.error("Flower sales stats error:", error);
    res.status(500).json({ error: error.message });
  }
};
