import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { codeService } from '../services/codeService';
import { MessageSquare, Send } from 'lucide-react';

interface CodeViewerProps {
  fileId: string;
  readOnly?: boolean;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ fileId, readOnly = true }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [showCommentInput, setShowCommentInput] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (fileId) {
      loadContent();
      loadComments();
    }
  }, [fileId]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const { data } = await codeService.getFileContent(fileId);
      setContent(data.content || '');
    } catch (error) {
      console.error(error);
      setContent('Error loading file content.');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data } = await codeService.getComments(fileId);
      setComments(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    // Add click listener for comments
    editor.onMouseDown((e: any) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        const lineNumber = e.target.position.lineNumber;
        setShowCommentInput(lineNumber);
      }
    });
  };

  const submitComment = async () => {
    if (!newComment.trim() || !showCommentInput) return;
    try {
      await codeService.addComment(fileId, showCommentInput, newComment);
      setNewComment('');
      setShowCommentInput(null);
      loadComments();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500 dark:text-gray-400">Loading code...</div>;

  return (
    <div className="h-full flex flex-col relative bg-white dark:bg-[#050505]">
      <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden relative">
        <Editor
          height="100%"
          defaultLanguage="javascript" // Autodetect?
          theme="vs-dark"
          value={content}
          options={{
            readOnly: readOnly,
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true
          }}
          onMount={handleEditorMount}
        />
        
        {/* Render Comments Overlay (Simplified) */}
        {comments.map((comment) => (
           <div 
             key={comment._id}
             className="absolute right-4 p-2 bg-yellow-100 rounded shadow-sm opacity-80 hover:opacity-100 transition-opacity text-xs w-48 z-10"
             style={{ top: `${(comment.line - 1) * 19}px` }} // Approx line height
           >
              <strong>{comment.userId?.name}</strong>: {comment.content}
           </div>
        ))}

        {showCommentInput && (
          <div className="absolute z-20 top-10 left-10 p-3 bg-white dark:bg-gray-800 shadow-xl border rounded text-sm w-72">
             <h4 className="font-bold mb-2">Comment on Line {showCommentInput}</h4>
             <textarea 
               className="w-full border p-1 rounded dark:bg-gray-700 dark:border-gray-600 mb-2"
               value={newComment}
               onChange={e => setNewComment(e.target.value)}
             />
             <div className="flex justify-end gap-2">
                 <button 
                  onClick={() => setShowCommentInput(null)}
                  className="px-2 py-1 text-gray-500"
                 >Cancel</button>
                 <button 
                   onClick={submitComment}
                   className="px-3 py-1 bg-blue-600 text-white rounded flex items-center"
                 >
                   <Send className="w-3 h-3 mr-1" /> Post
                 </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeViewer;
