const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");

const getProjectActivity = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit || 30), 200);
  const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

  const query = { projectId };
  if (cursor) {
    query.createdAt = { $lt: cursor };
  }

  const activity = await Activity.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", "name email avatar");

  const nextCursor = activity.length
    ? activity[activity.length - 1].createdAt
    : null;

  return res.status(200).json({ activity, nextCursor });
});

module.exports = {
  getProjectActivity,
};
