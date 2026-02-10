const admin = require("firebase-admin");
const path = require("path");

class FirebaseStorageService {
  constructor() {
    this.initialized = false;
    this.bucket = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  init() {
    if (this.initialized) return;

    try {
      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        const serviceAccountPath = process.env.FIREBASE_CREDENTIALS_PATH;
        const serviceAccountJson = process.env.FIREBASE_CREDENTIALS_JSON;

        if (serviceAccountPath) {
          const serviceAccount = require(path.resolve(serviceAccountPath));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          });
        } else if (serviceAccountJson) {
          const serviceAccount = JSON.parse(serviceAccountJson);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          });
        } else {
          throw new Error("Firebase credentials not configured");
        }
      }

      this.bucket = admin.storage().bucket();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Firebase Storage:", error);
      throw error;
    }
  }

  /**
   * Upload a buffer to Firebase Storage
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - Storage path
   * @param {string} mimeType - MIME type
   * @returns {Promise<{url: string, storageKey: string, size: number, mimeType: string}>}
   */
  async uploadBuffer(buffer, destinationPath, mimeType) {
    this.init();

    const file = this.bucket.file(destinationPath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
      public: false, // Set to false for private files
    });

    // Make file publicly accessible (optional, depends on requirements)
    // await file.makePublic();

    // Get signed URL for private access
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      url,
      storageKey: destinationPath,
      size: buffer.length,
      mimeType,
    };
  }

  /**
   * Delete a file from Firebase Storage
   * @param {string} storageKey - Storage path
   * @returns {Promise<void>}
   */
  async delete(storageKey) {
    this.init();

    const file = this.bucket.file(storageKey);
    await file.delete();
  }

  /**
   * Get a signed URL for secure access
   * @param {string} storageKey - Storage path
   * @param {number} expiresIn - Expiration in seconds (default 300)
   * @returns {Promise<string>}
   */
  async getSignedUrl(storageKey, expiresIn = 300) {
    this.init();

    const file = this.bucket.file(storageKey);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  }

  /**
   * Check if service is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      (process.env.FIREBASE_CREDENTIALS_PATH || process.env.FIREBASE_CREDENTIALS_JSON) &&
      process.env.FIREBASE_STORAGE_BUCKET
    );
  }
}

module.exports = new FirebaseStorageService();
