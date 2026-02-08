const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticate } = require('../middleware/auth');
// Assuming projectAccess middleware exists or we check manually in controller
// const { checkProjectAccess } = require('../middleware/projectAccess');

router.use(authenticate);

router.post('/', meetingController.createMeeting);
router.get('/project/:projectId', meetingController.getActiveMeetings);
router.put('/:meetingId/end', meetingController.endMeeting);

module.exports = router;
