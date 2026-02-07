const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");

const getProjectActivity = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit || 30), 100);

  const activity = await Activity.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", "name email avatar");

  return res.status(200).json({ activity });
});

module.exports = {
  getProjectActivity,
};
