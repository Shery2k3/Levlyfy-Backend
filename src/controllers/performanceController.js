
// Performance Controller: Leaderboard & Stats
const Call = require('../../models/call');
const User = require('../../models/user');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/leaderboard?period=weekly|monthly|all-time
async function getLeaderboard(req, res) {
  try {
    const { period = 'weekly' } = req.query;
    let dateFilter = {};
    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    // Get ALL users first
    const allUsers = await User.find({ isDeleted: { $ne: true } }, 'name email').lean();
    
    // Aggregate call stats for users who have made calls in the period
    const callStats = await Call.aggregate([
      { $match: dateFilter },
      { $group: {
          _id: '$userId',
          callsMade: { $sum: 1 },
          dealsClosed: { $sum: { $cond: ['$dealClosed', 1, 0] } },
          upsells: { $sum: { $cond: ['$upsell', 1, 0] } },
          totalScore: { $sum: { $ifNull: ['$score', 0] } },
        }
      },
    ]);

    // Create a map of user stats
    const statsMap = Object.fromEntries(
      callStats.map(stat => [stat._id.toString(), stat])
    );

    // Helper function to calculate rank based on multiple metrics
    const calculateRank = (stats) => {
      const { callsMade, dealsClosed, totalScore } = stats;
      
      // Multi-tier ranking system
      if (totalScore >= 500 && callsMade >= 10 && dealsClosed >= 3) {
        return 'challenger'; // Top tier (purple/blue)
      } else if (totalScore >= 200 && callsMade >= 5 && dealsClosed >= 1) {
        return 'gold'; // High performer
      } else if (totalScore >= 50 && callsMade >= 2) {
        return 'silver'; // Active user
      } else {
        return 'bronze'; // Beginner/inactive
      }
    };

    // Combine all users with their stats (or default values)
    const leaderboard = allUsers.map(user => {
      const stats = statsMap[user._id.toString()] || {
        callsMade: 0,
        dealsClosed: 0,
        upsells: 0,
        totalScore: 0,
      };
      
      return {
        userId: user._id,
        name: user.name || 'Unknown',
        callsMade: stats.callsMade,
        dealsClosed: stats.dealsClosed,
        upsells: stats.upsells,
        totalScore: stats.totalScore,
        rank: calculateRank(stats),
      };
    });

    // Sort by total score (descending) and add place
    leaderboard.sort((a, b) => b.totalScore - a.totalScore);
    const result = leaderboard.map((entry, idx) => ({
      ...entry,
      place: idx + 1,
    }));

    return successResponse(res, result, 'Leaderboard fetched');
  } catch (err) {
    return errorResponse(res, err.message || 'Failed to fetch leaderboard');
  }
}

// GET /api/leaderboard/me?period=weekly|monthly|all-time
async function getMyStats(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) return errorResponse(res, 'Unauthorized', 401);
    const { period = 'weekly' } = req.query;
    let dateFilter = { userId };
    if (period === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter.createdAt = { $gte: weekAgo };
    } else if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter.createdAt = { $gte: monthAgo };
    }
    const callsMade = await Call.countDocuments(dateFilter);
    const dealsClosed = await Call.countDocuments({ ...dateFilter, dealClosed: true });
    const upsells = await Call.countDocuments({ ...dateFilter, upsell: true });
    const totalScoreAgg = await Call.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$score', 0] } } } }
    ]);
    const totalScore = totalScoreAgg[0]?.total || 0;
    
    // Get calls made today (regardless of period filter)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const callsMadeToday = await Call.countDocuments({
      userId,
      createdAt: { $gte: startOfToday }
    });
    
    // Helper function to calculate rank (same logic as leaderboard)
    const calculateRank = (callsMade, dealsClosed, totalScore) => {
      if (totalScore >= 500 && callsMade >= 10 && dealsClosed >= 3) {
        return 'challenger';
      } else if (totalScore >= 200 && callsMade >= 5 && dealsClosed >= 1) {
        return 'gold';
      } else if (totalScore >= 50 && callsMade >= 2) {
        return 'silver';
      } else {
        return 'bronze';
      }
    };
    
    return successResponse(res, {
      callsMade,
      dealsClosed,
      upsells,
      totalScore,
      callsMadeToday,
      rank: calculateRank(callsMade, dealsClosed, totalScore),
    }, 'Your stats fetched');
  } catch (err) {
    return errorResponse(res, err.message || 'Failed to fetch stats');
  }
}

module.exports = { getLeaderboard, getMyStats };
