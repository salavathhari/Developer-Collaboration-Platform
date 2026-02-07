const Activity = require("../models/Activity");

const logActivity = async ({ projectId, actorId, type, payload }) => {
  return Activity.create({
    projectId,
    actorId,
    type,
    payload: payload || {},
  });
};

module.exports = {
  logActivity,
};
