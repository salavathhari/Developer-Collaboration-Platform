# File Attachment System

This document describes the file attachment system that allows users to upload files and link them to Projects, Tasks, Pull Requests, and Chat Messages.

## Table of Contents

- [Overview](#overview)
- [Storage Configuration](#storage-configuration)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Frontend Components](#frontend-components)
- [Socket Events](#socket-events)
- [Security](#security)
- [Testing](#testing)

## Overview

The file attachment system provides:

- **File Upload**: Upload files with drag-and-drop or file picker
- **Context Linking**: Attach files to tasks, PRs, or chat messages
- **Storage Abstraction**: Support for both AWS S3 and Firebase Storage
- **Permission Control**: Project-level and private file visibility
- **File Preview**: Preview images, PDFs, and text files
- **Versioning**: Replace files while maintaining version history
- **Real-time Notifications**: Socket.io events for file operations

## Storage Configuration

The system supports two storage providers: **AWS S3** (recommended) and **Firebase Storage**.

### AWS S3 (Recommended)

AWS S3 provides better performance, scalability, and cost-effectiveness for production deployments.

**Setup:**

1. Create an S3 bucket in your AWS account
2. Create an IAM user with S3 access permissions
3. Configure environment variables (see below)

**Advantages:**
- Better performance and reliability
- Lower costs at scale
- Industry-standard solution
- Built-in CDN integration (CloudFront)

### Firebase Storage

Firebase Storage is easier to set up for development and small projects.

**Setup:**

1. Create a Firebase project
2. Enable Firebase Storage
3. Download service account credentials JSON
4. Configure environment variables (see below)

**Advantages:**
- Easier initial setup
- Good for prototyping
- Integrated with Firebase ecosystem

### Switching Between Providers

Change the `STORAGE_PROVIDER` environment variable:

```env
# Use S3
STORAGE_PROVIDER=s3

# Use Firebase
STORAGE_PROVIDER=firebase
```

If S3 is not properly configured, the system will automatically fall back to Firebase (if configured).

## Environment Variables

Add these variables to your `.env` file:

### Storage Provider Selection

```env
# Storage provider: 's3' or 'firebase'
STORAGE_PROVIDER=s3
```

### AWS S3 Configuration

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

### Firebase Storage Configuration

```env
# Option 1: Path to service account JSON file
FIREBASE_CREDENTIALS_PATH=./path/to/serviceAccountKey.json

# Option 2: Service account JSON as environment variable
FIREBASE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...",...}'

# Firebase storage bucket name
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

### File Upload Limits

```env
# Maximum file size in bytes (default: 10MB)
FILE_MAX_BYTES=10485760

# Allowed MIME types (comma-separated, optional)
FILE_ALLOWED_TYPES=image/jpeg,image/png,application/pdf,text/plain
```

If `FILE_ALLOWED_TYPES` is not set, a default safe list is used (images, documents, text, archives).

## API Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`).

### Upload File

```http
POST /api/attachments/upload
Content-Type: multipart/form-data

Body:
- file: File (required)
- projectId: string (required)
- relatedTask: string (optional)
- relatedPR: string (optional)
- relatedChatMessage: string (optional)
- visibility: "project" | "private" (optional, default: "project")

Response 201:
{
  "message": "File uploaded successfully",
  "attachment": { ... }
}
```

### Get Project Files

```http
GET /api/attachments/project/:projectId
Query Parameters:
- context: "task" | "pr" | "chat" (optional)
- contextId: string (optional)

Response 200:
{
  "attachments": [...],
  "count": number
}
```

### Get Single File

```http
GET /api/attachments/:fileId

Response 200:
{
  "attachment": {
    ...file details,
    "signedUrl": "https://..." // Secure URL with expiration
  }
}
```

### Delete File

```http
DELETE /api/attachments/:fileId

Response 200:
{
  "message": "File deleted successfully"
}
```

**Permissions**: Only uploader or project owner can delete.

### Update File Links

```http
PUT /api/attachments/:fileId/link
Content-Type: application/json

Body:
{
  "relatedTask": "taskId", // optional
  "relatedPR": "prId", // optional
  "relatedChatMessage": "messageId" // optional
}

Response 200:
{
  "message": "File links updated successfully",
  "attachment": { ... }
}
```

**Note**: Only one context can be set at a time.

### Replace File

```http
POST /api/attachments/:fileId/replace
Content-Type: multipart/form-data

Body:
- file: File (required)

Response 200:
{
  "message": "File replaced successfully",
  "attachment": {
    ...file details,
    "version": 2,
    "meta": {
      "versions": [
        { "version": 1, "url": "...", "storageKey": "...", "replacedAt": "..." }
      ]
    }
  }
}
```

**Permissions**: Only original uploader can replace files.

## Frontend Components

### AttachmentUploader

Upload files with drag-and-drop support.

```tsx
import AttachmentUploader from './components/AttachmentUploader';

<AttachmentUploader
  projectId="project123"
  relatedTask="task456" // optional
  visibility="project"
  onUploadComplete={(attachment) => console.log('Uploaded:', attachment)}
  onUploadError={(error) => console.error('Error:', error)}
  maxSizeMB={10}
/>
```

### FileList

Display list of uploaded files.

```tsx
import FileList from './components/FileList';

<FileList
  files={attachments}
  onFileDeleted={(fileId) => console.log('Deleted:', fileId)}
  showContext={true}
  allowDelete={true}
/>
```

### FilePreview

Preview files in modal.

```tsx
import FilePreview from './components/FilePreview';

{showPreview && (
  <FilePreview
    file={selectedFile}
    onClose={() => setShowPreview(false)}
  />
)}
```

### FilePickerModal

Select existing files.

```tsx
import FilePickerModal from './components/FilePickerModal';

{showPicker && (
  <FilePickerModal
    projectId="project123"
    onFileSelect={(file) => console.log('Selected:', file)}
    onClose={() => setShowPicker(false)}
    filterContext="task"
    filterContextId="task456"
  />
)}
```

## Socket Events

The system emits real-time events to project rooms (`project:${projectId}`).

### Server → Client Events

#### file:uploaded

Emitted when a file is uploaded.

```typescript
socket.on('file:uploaded', (data) => {
  console.log('File uploaded:', data);
  // data: { fileId, name, uploadedBy, size, mimeType, relatedTask, relatedPR, relatedChatMessage, createdAt }
});
```

#### file:deleted

Emitted when a file is deleted.

```typescript
socket.on('file:deleted', (data) => {
  console.log('File deleted:', data);
  // data: { fileId, deletedBy }
});
```

#### file:linked

Emitted when file links are updated.

```typescript
socket.on('file:linked', (data) => {
  console.log('File linked:', data);
  // data: { fileId, relatedTask, relatedPR, relatedChatMessage }
});
```

#### file:replaced

Emitted when a file is replaced (new version).

```typescript
socket.on('file:replaced', (data) => {
  console.log('File replaced:', data);
  // data: { fileId, version, replacedBy }
});
```

### Client → Server Events

#### file:viewing

Notify when viewing a file.

```typescript
socket.emit('file:viewing', {
  fileId: 'file123',
  projectId: 'project456'
});
```

#### file:stopViewing

Notify when stopped viewing a file.

```typescript
socket.emit('file:stopViewing', {
  fileId: 'file123',
  projectId: 'project456'
});
```

## Security

### File Validation

- **Size Limit**: Configurable via `FILE_MAX_BYTES` (default: 10MB)
- **MIME Type Whitelist**: Only allowed file types can be uploaded
- **Extension Blacklist**: Dangerous extensions (.exe, .bat, .sh, etc.) are blocked
- **Filename Sanitization**: Removes path traversal and special characters

### Virus Scanning

A placeholder for virus scanning is included in `uploadMiddleware.js`. In production:

```javascript
const clamav = require('clamav.js');

const scanForVirus = async (buffer) => {
  const result = await clamav.scanBuffer(buffer);
  if (result.isInfected) {
    throw new Error('Virus detected in uploaded file');
  }
  return true;
};
```

### Access Control

- **Project Membership**: Only project members can upload/view files
- **Visibility Levels**:
  - `project`: All project members can view
  - `private`: Only uploader and project owner can view
- **Deletion**: Only uploader or project owner can delete files
- **Replacement**: Only original uploader can replace files

### Signed URLs

Files use signed URLs for secure access:
- S3 pre-signed URLs (configurable expiration)
- Firebase signed URLs (7-day expiration by default)
- URLs expire after specified time for security

## Testing

Run the test suite:

```bash
cd server
npm test -- tests/attachment.test.js
```

### Test Coverage

- ✅ File upload with validation
- ✅ Authentication and authorization
- ✅ Context linking (task/PR/chat)
- ✅ File retrieval and filtering
- ✅ Permission checks (visibility)
- ✅ File deletion
- ✅ File replacement and versioning
- ✅ Link updates

### Manual Testing

1. **Upload Test**:
   ```bash
   curl -X POST http://localhost:5000/api/attachments/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@/path/to/file.pdf" \
     -F "projectId=PROJECT_ID"
   ```

2. **Get Files Test**:
   ```bash
   curl http://localhost:5000/api/attachments/project/PROJECT_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Delete Test**:
   ```bash
   curl -X DELETE http://localhost:5000/api/attachments/FILE_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Troubleshooting

### Storage Provider Issues

**Error: "Storage service not properly configured"**

- Check environment variables for your chosen provider
- Ensure credentials are valid
- Verify bucket/storage exists and is accessible

**S3 upload fails with "Access Denied"**

- Verify IAM user permissions
- Check bucket CORS configuration
- Ensure bucket policy allows PutObject

**Firebase initialization error**

- Verify service account JSON is valid
- Check Firebase project is active
- Ensure Storage is enabled in Firebase console

### File Upload Issues

**Error: "File too large"**

- Check `FILE_MAX_BYTES` setting
- Default limit is 10MB
- Also check Express body parser limits in app.js

**Error: "File type not allowed"**

- Check `FILE_ALLOWED_TYPES` configuration
- Ensure MIME type is in whitelist
- Extension must not be in blacklist

### Performance

For large file uploads, consider:

- Implement direct-to-S3 uploads with pre-signed POST URLs
- Use multipart uploads for files >5MB
- Enable CloudFront CDN for downloads
- Implement client-side compression for images

## Future Enhancements

- [ ] Direct-to-S3 uploads (client-side)
- [ ] Image thumbnail generation
- [ ] Batch file upload
- [ ] File sharing with external users
- [ ] Advanced search and filtering
- [ ] File comments and annotations
- [ ] Audit log for file operations
- [ ] Integration with cloud storage providers (Dropbox, Google Drive)
