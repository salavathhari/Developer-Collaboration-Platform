const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectOwner } = require("../middleware/projectAccess");
const {
  validateProjectCreate,
  validateInvite,
  validateInviteAccept,
  validateMemberRole,
} = require("../middleware/validators");
const {
  createProject,
  getMyProjects,
  inviteMember,
  createInviteLink,
  acceptInvite,
  updateMemberRole,
} = require("../controllers/projectController");

const router = express.Router();

router.get("/", authenticate, getMyProjects);
router.post("/", authenticate, validateProjectCreate, createProject);
router.post(
  "/:projectId/invite",
  authenticate,
  requireProjectOwner,
  validateInvite,
  inviteMember
);
router.post(
  "/:projectId/invite-link",
  authenticate,
  requireProjectOwner,
  createInviteLink
);
router.post("/invites/accept", authenticate, validateInviteAccept, acceptInvite);
router.patch(
  "/:projectId/members/:memberId/role",
  authenticate,
  requireProjectOwner,
  validateMemberRole,
  updateMemberRole
);

module.exports = router;
