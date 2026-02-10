/**
 * Socket.io handlers for file/attachment events
 * These events are emitted from controllers when files are uploaded/modified
 */

module.exports = (io) => {
  // File events are emitted to project rooms: `project:${projectId}`
  
  // Listen for client requests to download file
  io.on("connection", (socket) => {
    
    // Client requests file download URL
    socket.on("file:requestDownload", async (data) => {
      try {
        const { fileId } = data;
        
        // This would typically be handled by REST API GET /api/attachments/:fileId
        // but we can also provide real-time signed URL generation
        
        socket.emit("file:downloadReady", {
          fileId,
          message: "Use REST API to get signed download URL",
        });
      } catch (error) {
        socket.emit("error", {
          message: "Failed to process download request",
          error: error.message,
        });
      }
    });
    
    // Client notifies they are viewing a file
    socket.on("file:viewing", (data) => {
      const { fileId, projectId } = data;
      
      // Broadcast to others in the project
      socket.to(`project:${projectId}`).emit("file:userViewing", {
        fileId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });
    
    // Client stopped viewing file
    socket.on("file:stopViewing", (data) => {
      const { fileId, projectId } = data;
      
      socket.to(`project:${projectId}`).emit("file:userStoppedViewing", {
        fileId,
        userId: socket.userId,
      });
    });
  });
  
  /**
   * Server-side emit helpers (called from controllers)
   */
  
  const emitFileUploaded = (projectId, fileData) => {
    io.to(`project:${projectId}`).emit("file:uploaded", fileData);
  };
  
  const emitFileDeleted = (projectId, fileId, deletedBy) => {
    io.to(`project:${projectId}`).emit("file:deleted", {
      fileId,
      deletedBy,
    });
  };
  
  const emitFileLinked = (projectId, fileData) => {
    io.to(`project:${projectId}`).emit("file:linked", fileData);
  };
  
  const emitFileReplaced = (projectId, fileData) => {
    io.to(`project:${projectId}`).emit("file:replaced", fileData);
  };
  
  return {
    emitFileUploaded,
    emitFileDeleted,
    emitFileLinked,
    emitFileReplaced,
  };
};
