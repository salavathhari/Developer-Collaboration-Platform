const Project = require("../models/Project");
const User = require("../models/User");
const Invite = require("../models/Invite");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { createInviteToken, hashToken } = require("../utils/token");
const { createNotification, emitNotification } = require("../utils/notify");
const { logActivity } = require("../utils/activity");
const { sendEmail } = require("../utils/email");

const inviteTtlMs = Number(process.env.INVITE_TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 7);

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await Project.create({
    name,
    description,
    owner: req.user.id,
    members: [{ user: req.user.id, role: "owner" }],
  });

  await logActivity({
    projectId: project.id,
    actorId: req.user.id,
    type: "projectCreated",
    payload: { projectId: project.id },
  });

  return res.status(201).json({ project });
});

const getMyProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user.id }, { "members.user": req.user.id }],
  })
    .populate("owner", "name email avatar")
    .populate("members.user", "name email avatar role")
    .sort({ createdAt: -1 });

  return res.status(200).json({ projects });
});

const inviteMember = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const { project } = req;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedEmail) {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const alreadyMember = project.members.some(
        (member) => member.user.toString() === existingUser.id
      );

      if (alreadyMember) {
        throw new ApiError(409, "User is already a member");
      }
    }

    const existingInvite = await Invite.findOne({
      projectId: project.id,
      email: normalizedEmail,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      throw new ApiError(409, "Invite already sent to this email");
    }
  }

  const { token, tokenHash, expiresAt } = createInviteToken(inviteTtlMs);

  await Invite.create({
    projectId: project.id,
    inviterId: req.user.id,
    email: normalizedEmail || null,
    tokenHash,
    expiresAt,
    status: "pending",
  });

  await logActivity({
    projectId: project.id,
    actorId: req.user.id,
    type: "userInvited",
    payload: { email: normalizedEmail || null },
  });

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const inviteLink = `${clientUrl}/invite/${token}`;

  try {
    const inviterName = req.user.name || req.user.email;
    await sendEmail({
      to: normalizedEmail,
      subject: `${inviterName} invited you to join ${project.name} on DevCollab`,
      html: `
        <div style="font-family: monospace; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 8px;">
          <h2 style="color: #6366f1;">Join ${project.name}</h2>
          <p>You have been invited by <strong>${inviterName}</strong> to collaborate on <strong>${project.name}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Accept Invitation</a>
          </div>
          <p style="color: #6b7280; font-size: 12px;">This link will expire in 7 days.</p>
          <p style="color: #6b7280; font-size: 12px;">If you can't click the button, copy and paste this link:<br>${inviteLink}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send invite email", err);
  }

  return res.status(201).json({ inviteLink, expiresAt });
});

const createInviteLink = asyncHandler(async (req, res) => {
  const { project } = req;
  await Invite.updateMany(
    {
      projectId: project.id,
      email: null,
      status: "pending",
      expiresAt: { $gt: new Date() },
    },
    { status: "revoked" }
  );

  const { token, tokenHash, expiresAt } = createInviteToken(inviteTtlMs);

  await Invite.create({
    projectId: project.id,
    inviterId: req.user.id,
    email: null,
    tokenHash,
    expiresAt,
    status: "pending",
  });

  await logActivity({
    projectId: project.id,
    actorId: req.user.id,
    type: "inviteLinkCreated",
    payload: {},
  });

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const inviteLink = `${clientUrl}/invite/${token}`;

  return res.status(201).json({ inviteLink, expiresAt });
});

const acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const tokenHash = hashToken(token);

  const invite = await Invite.findOne({ tokenHash, status: "pending" });
  if (!invite) {
    throw new ApiError(400, "Invite token is invalid or expired");
  }

  if (invite.expiresAt <= new Date()) {
    invite.status = "expired";
    await invite.save();
    throw new ApiError(400, "Invite token is invalid or expired");
  }

  const project = await Project.findById(invite.projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const alreadyMember = project.members.some(
    (member) => member.user.toString() === req.user.id
  );

  if (!alreadyMember) {
    project.members.push({ user: req.user.id, role: "member" });
  }

  await project.save();

  invite.status = "accepted";
  invite.acceptedBy = req.user.id;
  invite.acceptedAt = new Date();
  await invite.save();

  await logActivity({
    projectId: project.id,
    actorId: req.user.id,
    type: "userInvitedAccepted",
    payload: { userId: req.user.id },
  });

  const io = req.app.get("io");
  const notification = await createNotification({
    userId: invite.inviterId,
    type: "invite_accepted",
    projectId: project.id,
    payload: { projectId: project.id, userId: req.user.id },
  });
  emitNotification(io, notification);

  return res.status(200).json({ project });
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { project } = req;
  const { memberId } = req.params;
  const { role } = req.body;

  const memberEntry = project.members.find(
    (member) => member.user.toString() === memberId
  );

  if (!memberEntry) {
    throw new ApiError(404, "Member not found");
  }

  memberEntry.role = role;
  await project.save();

  return res.status(200).json({ project });
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (String(project.owner) !== req.user.id) {
    throw new ApiError(403, "Only the owner can delete the project");
  }

  await Project.deleteOne({ _id: projectId });

  return res.status(200).json({ success: true, projectId });
});

module.exports = {
  createProject,
  getMyProjects,
  inviteMember,
  createInviteLink,
  acceptInvite,
  updateMemberRole,
  deleteProject,
};
