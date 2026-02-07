const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Task = require("../src/models/Task");
const Message = require("../src/models/Message");
const Activity = require("../src/models/Activity");

dotenv.config();

const seed = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing");
  }

  await mongoose.connect(process.env.MONGO_URI);

  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Message.deleteMany({}),
    Activity.deleteMany({}),
  ]);

  const password = await bcrypt.hash("Password123", 10);
  const owner = await User.create({
    name: "Owner User",
    email: "owner@example.com",
    password,
    role: "owner",
  });

  const member = await User.create({
    name: "Member User",
    email: "member@example.com",
    password,
    role: "member",
  });

  const project = await Project.create({
    name: "Seeded Project",
    description: "Seed data for local testing",
    owner: owner.id,
    members: [
      { user: owner.id, role: "owner" },
      { user: member.id, role: "member" },
    ],
  });

  await Task.create([
    {
      projectId: project.id,
      title: "Set up repository",
      description: "Initialize project structure",
      status: "done",
      priority: "medium",
      createdBy: owner.id,
      assignees: [owner.id],
    },
    {
      projectId: project.id,
      title: "Plan sprint backlog",
      description: "Gather requirements and outline tasks",
      status: "in_progress",
      priority: "high",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      createdBy: owner.id,
      assignees: [member.id],
    },
  ]);

  await Message.create([
    {
      projectId: project.id,
      senderId: owner.id,
      content: "Welcome to the seeded workspace!",
      readBy: [owner.id],
      attachments: [],
    },
    {
      projectId: project.id,
      senderId: member.id,
      content: "Looking forward to collaborating.",
      readBy: [member.id],
      attachments: [],
    },
  ]);

  await Activity.create({
    projectId: project.id,
    actorId: owner.id,
    type: "seeded",
    payload: { message: "Seed data generated" },
  });

  console.log("Seed complete:");
  console.log("Owner: owner@example.com / Password123");
  console.log("Member: member@example.com / Password123");
  console.log(`Project: ${project.name}`);

  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
