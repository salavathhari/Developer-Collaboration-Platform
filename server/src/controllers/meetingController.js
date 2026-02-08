const Meeting = require('../models/Meeting');
const Project = require('../models/Project');

exports.createMeeting = async (req, res) => {
  try {
    const { projectId, title, type, referenceId } = req.body;
    const userId = req.user.userId;

    // Verify project membership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const isMember = project.owner.toString() === userId || 
                     project.members.some(m => m.user.toString() === userId);
    
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this project' });
    }

    // Check if there is already an active meeting for this context?
    // Maybe we allow multiple? Let's allow multiple for now if types differ.

    const meeting = await Meeting.create({
      roomId: `mtg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      host: userId,
      title,
      type,
      referenceId,
      participants: [{ user: userId, joinedAt: new Date() }],
      status: 'active'
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getActiveMeetings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const authUserId = req.user.userId;

    // Verify membership (middleware usually does this, but for safety)
    
    const meetings = await Meeting.find({
      projectId,
      status: 'active'
    }).populate('host', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.json(meetings);
  } catch (error) {
    console.error('Get active meetings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (meeting.host.toString() !== userId) {
        // Allow project owner to end it too?
        const project = await Project.findById(meeting.projectId);
        if (project.owner.toString() !== userId) {
            return res.status(403).json({ message: 'Only host can end meeting' });
        }
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();

    res.json(meeting);
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
