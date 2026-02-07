const ApiError = require("../utils/ApiError");
const Project = require("../models/Project");
const asyncHandler = require("../utils/asyncHandler");

const requireProjectOwner = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isOwner = project.owner.toString() === req.user.id;
  const memberEntry = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!isOwner && (!memberEntry || memberEntry.role !== "owner")) {
    throw new ApiError(403, "Only owners can manage this project");
  }

  req.project = project;
  return next();
});

const requireProjectMember = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isOwner = project.owner.toString() === req.user.id;
  const memberEntry = project.members.find(
    (member) => member.user.toString() === req.user.id
  );

  if (!isOwner && !memberEntry) {
    throw new ApiError(403, "Project access required");
  }

  req.project = project;
  return next();
});

module.exports = {
  requireProjectOwner,
  requireProjectMember,
};
