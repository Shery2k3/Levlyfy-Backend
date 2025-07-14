const {
  successResponse,
  errorResponse,
  serverErrorResponse,
} = require("../utils/response.js");
const Call = require("../../models/call.js");
const User = require("../../models/user.js");
const mongoose = require("mongoose");

/**
 * Get user rankings based on call performance scores
 * Ranks users by average score, total calls, and sentiment analysis
 */
const getUserRankings = async (req, res) => {
  try {

    // Get query parameters for filtering
    const { 
      limit = 10, 
      timeframe = "all", // "week", "month", "quarter", "all"
      sortBy = "avgScore" // "avgScore", "totalCalls", "positiveRatio"
    } = req.query;

    // Build date filter based on timeframe
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case "week":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case "month":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case "quarter":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = {}; // All time
    }

    // Aggregate user rankings with call statistics
    const rankings = await Call.aggregate([
      {
        $match: {
          status: "analyzed",
          score: { $exists: true, $ne: null },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: "$userId",
          totalCalls: { $sum: 1 },
          avgScore: { $avg: "$score" },
          maxScore: { $max: "$score" },
          minScore: { $min: "$score" },
          totalPositive: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0]
            }
          },
          totalNegative: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0]
            }
          },
          totalNeutral: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "Neutral"] }, 1, 0]
            }
          },
          recentCalls: {
            $push: {
              score: "$score",
              sentiment: "$sentiment",
              createdAt: "$createdAt",
              summary: "$summary"
            }
          }
        }
      },
      {
        $addFields: {
          positiveRatio: {
            $cond: [
              { $eq: ["$totalCalls", 0] },
              0,
              { $divide: ["$totalPositive", "$totalCalls"] }
            ]
          },
          negativeRatio: {
            $cond: [
              { $eq: ["$totalCalls", 0] },
              0,
              { $divide: ["$totalNegative", "$totalCalls"] }
            ]
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: "$userInfo"
      },
      {
        $project: {
          userId: "$_id",
          name: "$userInfo.name",
          email: "$userInfo.email",
          totalCalls: 1,
          avgScore: { $round: ["$avgScore", 1] },
          maxScore: 1,
          minScore: 1,
          totalPositive: 1,
          totalNegative: 1,
          totalNeutral: 1,
          positiveRatio: { $round: ["$positiveRatio", 3] },
          negativeRatio: { $round: ["$negativeRatio", 3] },
          recentCalls: { $slice: ["$recentCalls", -5] } // Last 5 calls
        }
      }
    ]);

    // Sort rankings based on sortBy parameter
    let sortCriteria = {};
    switch (sortBy) {
      case "totalCalls":
        sortCriteria = { totalCalls: -1, avgScore: -1 };
        break;
      case "positiveRatio":
        sortCriteria = { positiveRatio: -1, avgScore: -1 };
        break;
      default:
        sortCriteria = { avgScore: -1, totalCalls: -1 };
    }

    // Apply sorting and limit
    const sortedRankings = rankings.sort((a, b) => {
      for (const [key, order] of Object.entries(sortCriteria)) {
        if (a[key] !== b[key]) {
          return order === -1 ? b[key] - a[key] : a[key] - b[key];
        }
      }
      return 0;
    }).slice(0, parseInt(limit));

    // Add ranking positions
    const rankedUsers = sortedRankings.map((user, index) => ({
      ...user,
      rank: index + 1,
      badge: getRankBadge(index + 1, user.avgScore)
    }));

    return successResponse(
      res,
      {
        rankings: rankedUsers,
        metadata: {
          totalUsers: rankings.length,
          timeframe,
          sortBy,
          generatedAt: new Date().toISOString()
        }
      },
      "User rankings retrieved successfully"
    );

  } catch (error) {
    console.error("❌ Error fetching user rankings:", error);
    return serverErrorResponse(res, "Failed to fetch user rankings");
  }
};

/**
 * Get overall dashboard analytics
 * Returns system-wide metrics and trends
 */
const getDashboardAnalytics = async (req, res) => {
  try {

    const { timeframe = "month" } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case "week":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case "month":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case "quarter":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = {};
    }

    // Get overall statistics
    const [overallStats, dailyTrends, topPerformers] = await Promise.all([
      // Overall statistics
      Call.aggregate([
        { $match: { status: "analyzed", ...dateFilter } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            avgScore: { $avg: "$score" },
            totalPositive: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0] }
            },
            totalNegative: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0] }
            },
            totalNeutral: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Neutral"] }, 1, 0] }
            },
            highScores: {
              $sum: { $cond: [{ $gte: ["$score", 80] }, 1, 0] }
            },
            lowScores: {
              $sum: { $cond: [{ $lte: ["$score", 50] }, 1, 0] }
            }
          }
        }
      ]),

      // Daily trends for the selected timeframe
      Call.aggregate([
        { $match: { status: "analyzed", ...dateFilter } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
            },
            callCount: { $sum: 1 },
            avgScore: { $avg: "$score" },
            positiveCount: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0] }
            }
          }
        },
        { $sort: { "_id.date": 1 } },
        { $limit: 30 }
      ]),

      // Top 5 performers
      Call.aggregate([
        { $match: { status: "analyzed", ...dateFilter } },
        {
          $group: {
            _id: "$userId",
            avgScore: { $avg: "$score" },
            totalCalls: { $sum: 1 }
          }
        },
        { $match: { totalCalls: { $gte: 3 } } }, // At least 3 calls
        { $sort: { avgScore: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $project: {
            name: "$user.name",
            avgScore: { $round: ["$avgScore", 1] },
            totalCalls: 1
          }
        }
      ])
    ]);

    const stats = overallStats[0] || {
      totalCalls: 0,
      avgScore: 0,
      totalPositive: 0,
      totalNegative: 0,
      totalNeutral: 0,
      highScores: 0,
      lowScores: 0
    };

    const analytics = {
      summary: {
        totalCalls: stats.totalCalls,
        averageScore: Math.round(stats.avgScore * 10) / 10,
        positiveRatio: stats.totalCalls > 0 ? Math.round((stats.totalPositive / stats.totalCalls) * 100) : 0,
        highPerformanceRatio: stats.totalCalls > 0 ? Math.round((stats.highScores / stats.totalCalls) * 100) : 0
      },
      sentimentBreakdown: {
        positive: stats.totalPositive,
        negative: stats.totalNegative,
        neutral: stats.totalNeutral
      },
      performanceDistribution: {
        highScores: stats.highScores, // 80+
        mediumScores: stats.totalCalls - stats.highScores - stats.lowScores,
        lowScores: stats.lowScores // 50 or below
      },
      dailyTrends: dailyTrends.map(day => ({
        date: day._id.date,
        callCount: day.callCount,
        avgScore: Math.round(day.avgScore * 10) / 10,
        positiveCount: day.positiveCount
      })),
      topPerformers: topPerformers
    };

    console.log("✅ Dashboard analytics retrieved successfully");

    return successResponse(
      res,
      {
        analytics,
        metadata: {
          timeframe,
          generatedAt: new Date().toISOString()
        }
      },
      "Dashboard analytics retrieved successfully"
    );

  } catch (error) {
    console.error("❌ Error fetching dashboard analytics:", error);
    return serverErrorResponse(res, "Failed to fetch dashboard analytics");
  }
};

/**
 * Get user-specific dashboard data
 * Returns personalized metrics for the authenticated user
 */
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return errorResponse(res, 401, "User authentication required");
    }

    console.log(`📊 Fetching dashboard for user: ${userId}`);

    const { timeframe = "month" } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case "week":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case "month":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case "quarter":
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = {};
    }

    // Get user-specific analytics
    const [userStats, recentCalls, userRank] = await Promise.all([
      // User statistics
      Call.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: "analyzed", ...dateFilter } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            avgScore: { $avg: "$score" },
            maxScore: { $max: "$score" },
            minScore: { $min: "$score" },
            totalPositive: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0] }
            },
            totalNegative: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0] }
            },
            totalNeutral: {
              $sum: { $cond: [{ $eq: ["$sentiment", "Neutral"] }, 1, 0] }
            }
          }
        }
      ]),

      // Recent calls with full details
      Call.find({ 
        userId: new mongoose.Types.ObjectId(userId), 
        status: "analyzed",
        ...dateFilter 
      })
      .select("score sentiment summary feedback createdAt callNotes")
      .sort({ createdAt: -1 })
      .limit(10),

      // User ranking position
      Call.aggregate([
        { $match: { status: "analyzed", ...dateFilter } },
        {
          $group: {
            _id: "$userId",
            avgScore: { $avg: "$score" },
            totalCalls: { $sum: 1 }
          }
        },
        { $sort: { avgScore: -1, totalCalls: -1 } }
      ])
    ]);

    const stats = userStats[0] || {
      totalCalls: 0,
      avgScore: 0,
      maxScore: 0,
      minScore: 0,
      totalPositive: 0,
      totalNegative: 0,
      totalNeutral: 0
    };

    // Calculate user rank
    const userRankPosition = userRank.findIndex(
      user => user._id.toString() === userId.toString()
    ) + 1;

    const userDashboard = {
      personalStats: {
        totalCalls: stats.totalCalls,
        averageScore: Math.round(stats.avgScore * 10) / 10,
        bestScore: stats.maxScore,
        lowestScore: stats.minScore,
        positiveRatio: stats.totalCalls > 0 ? Math.round((stats.totalPositive / stats.totalCalls) * 100) : 0,
        rank: userRankPosition || "Not ranked",
        badge: getRankBadge(userRankPosition, stats.avgScore)
      },
      sentimentBreakdown: {
        positive: stats.totalPositive,
        negative: stats.totalNegative,
        neutral: stats.totalNeutral
      },
      recentCalls: recentCalls.map(call => ({
        id: call._id,
        score: call.score,
        sentiment: call.sentiment,
        summary: call.summary,
        feedback: call.feedback,
        date: call.createdAt,
        notes: call.callNotes
      })),
      performance: {
        trend: calculatePerformanceTrend(recentCalls),
        improvementAreas: getImprovementSuggestions(stats, recentCalls)
      }
    };

    return successResponse(
      res,
      {
        dashboard: userDashboard,
        metadata: {
          userId,
          timeframe,
          generatedAt: new Date().toISOString()
        }
      },
      "User dashboard retrieved successfully"
    );

  } catch (error) {
    console.error("❌ Error fetching user dashboard:", error);
    return serverErrorResponse(res, "Failed to fetch user dashboard");
  }
};

// Helper functions
const getRankBadge = (rank, avgScore) => {
  if (rank === 1) return "🏆 Champion";
  if (rank <= 3) return "🥉 Top Performer";
  if (rank <= 10) return "⭐ High Achiever";
  if (avgScore >= 80) return "🌟 Expert";
  if (avgScore >= 60) return "📈 Improving";
  return "🎯 Getting Started";
};

const calculatePerformanceTrend = (recentCalls) => {
  if (recentCalls.length < 2) return "insufficient_data";
  
  const recent = recentCalls.slice(0, 3);
  const older = recentCalls.slice(3, 6);
  
  if (older.length === 0) return "insufficient_data";
  
  const recentAvg = recent.reduce((sum, call) => sum + call.score, 0) / recent.length;
  const olderAvg = older.reduce((sum, call) => sum + call.score, 0) / older.length;
  
  const difference = recentAvg - olderAvg;
  
  if (difference > 5) return "improving";
  if (difference < -5) return "declining";
  return "stable";
};

const getImprovementSuggestions = (stats, recentCalls) => {
  const suggestions = [];
  
  if (stats.avgScore < 60) {
    suggestions.push("Focus on active listening and customer needs identification");
  }
  
  if (stats.totalNegative > stats.totalPositive) {
    suggestions.push("Work on building rapport and positive communication");
  }
  
  if (stats.totalCalls < 5) {
    suggestions.push("Increase call volume to improve experience and confidence");
  }
  
  const hasLowRecentScores = recentCalls.some(call => call.score < 50);
  if (hasLowRecentScores) {
    suggestions.push("Review recent call feedback and practice key improvement areas");
  }
  
  return suggestions.length > 0 ? suggestions : ["Keep up the great work!"];
};

module.exports = {
  getUserRankings,
  getDashboardAnalytics,
  getUserDashboard
};