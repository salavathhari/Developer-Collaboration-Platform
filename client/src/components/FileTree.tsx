import React, { useState } from 'react';
import { 
  Folder, FileCode, ChevronRight, ChevronDown 
} from 'lucide-react';

interface FileNode {
  _id: string;
  filePath: string;
  fileName: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FileTreeProps {
  files: any[];
  onSelect: (fileId: string) => void;
  selectedFileId: string | null;
}

const buildTree = (files: any[]): FileNode[] => {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  // Sort files so folders come first
  const sortedFiles = [...files].sort((a, b) => {
      // Very basic sort, can be improved
      return a.filePath.localeCompare(b.filePath);
  });

  // Basic flat list to tree not fully implemented for brevity, 
  // currently we iterate and assume paths. 
  // However, the backend sends a flat list. 
  // Let's just render a flat list with indentation based on slashes for MVP efficiency
  // or a simple folder structure.
  
  return sortedFiles; // Returning flat for the "Simple List" approach first
};

const FileTree: React.FC<FileTreeProps> = ({ files, onSelect, selectedFileId }) => {
  // Simple flat view with indentation for MVP reliability
  return (
    <div className="text-sm">
      {files.map((file) => {
        const depth = file.filePath.split('/').length - 1;
        const isSelected = selectedFileId === file._id;
        
        return (
          <div
            key={file._id}
            onClick={() => onSelect(file._id)}
            className={`
              flex items-center py-1.5 px-2 cursor-pointer rounded-md mb-0.5 transition-colors
              ${isSelected 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' 
                  : 'hover:bg-gray-100 dark:hover:bg-[#161b22] text-gray-700 dark:text-gray-400'}
            `}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {file.fileName.includes('.') ? (
              <FileCode className={`h-4 w-4 mr-2 ${isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400'}`} />
            ) : (
                <Folder className="h-4 w-4 mr-2 text-yellow-500" />
            )}
            <span className="truncate">{file.fileName}</span>
          </div>
        );
      })}
      {files.length === 0 && (
         <div className="p-4 text-gray-500 text-center text-xs">No files found</div>
      )}
    </div>
  );
};

export default FileTree;
