const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer
const uploadDir = 'uploads/temp';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix)
  }
});

const upload = multer({ storage: storage });

router.use(authenticate);

router.get('/repos/:projectId', codeController.getRepo);
router.get('/files/:repoId', codeController.getFiles);
router.get('/file/:fileId', codeController.getFileContent);
router.post('/commit', codeController.commitChanges);
router.get('/diff', codeController.getDiff);

// Upload
router.post('/upload', upload.single('file'), codeController.uploadFile);

// Comments
router.post('/comment', codeController.addComment);
router.get('/comments/:fileId', codeController.getComments);

module.exports = router;
