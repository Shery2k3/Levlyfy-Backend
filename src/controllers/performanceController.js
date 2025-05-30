const { Sequelize } = require("../../models");
const db = require("../../models/index.js");
const PerformanceRepo = require("../repos/PerformanceRepo.js");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
} = require("./baseController.js");

getLeaderboard = async (req, res) => {
  const topAgents = await PerformanceRepo.findAll({
    attributes: [
      "userId",
      [Sequelize.fn("AVG", Sequelize.col("score")), "averageScore"],
      [Sequelize.fn("COUNT", Sequelize.col("id")), "totalCalls"],
    ],
    include: [
      {
        model: db.User,
        as: "user",
        attributes: ["id", "name", "email"],
      },
    ],
    group: ["userId", "user.id"],
    order: [[Sequelize.fn("AVG", Sequelize.col("score")), "DESC"]],
    limit: 10,
  });

  return successResponse(res, topAgents, "Top agents fetched successfully");
};

module.exports = {
  getLeaderboard,
};
