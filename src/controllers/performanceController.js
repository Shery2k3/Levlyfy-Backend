
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
    // Aggregate leaderboard stats
    const leaderboard = await Call.aggregate([
      { $match: dateFilter },
      { $group: {
          _id: '$userId',
          callsMade: { $sum: 1 },
          dealsClosed: { $sum: { $cond: ['$dealClosed', 1, 0] } },
          upsells: { $sum: { $cond: ['$upsell', 1, 0] } },
          totalScore: { $sum: { $ifNull: ['$score', 0] } },
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: 20 },
    ]);
    // Populate user info
    const userIds = leaderboard.map(l => l._id);
    const users = await User.find({ _id: { $in: userIds } }, 'name email');
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const result = leaderboard.map((entry, idx) => ({
      place: idx + 1,
      userId: entry._id,
      name: userMap[entry._id.toString()]?.name || 'Unknown',
      callsMade: entry.callsMade,
      dealsClosed: entry.dealsClosed,
      upsells: entry.upsells,
      totalScore: entry.totalScore,
      rank: entry.totalScore > 1000 ? 'challenger' : 'gold', // Example logic
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
    return successResponse(res, {
      callsMade,
      dealsClosed,
      upsells,
      totalScore,
      rank: totalScore > 1000 ? 'challenger' : 'gold', // Example logic
    }, 'Your stats fetched');
  } catch (err) {
    return errorResponse(res, err.message || 'Failed to fetch stats');
  }
}

module.exports = { getLeaderboard, getMyStats };
