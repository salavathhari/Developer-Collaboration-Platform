import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { FileAsset, Project } from "../types";
import { getFiles, uploadFile } from "../services/fileService";
import { useSocket } from "../hooks/useSocket";

const FilesView = ({ project }: { project: Project }) => {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const projectId = project._id || project.id;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFiles(projectId);
        setFiles(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (projectId) load();
  }, [projectId]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const onFileUploaded = ({ file }: { file: FileAsset }) => {
       if (file.projectId === projectId) {
         setFiles(prev => [file, ...prev]);
       }
    };

    socket.on("file_uploaded", onFileUploaded);
    socket.emit("join_room", { projectId });

    return () => {
      socket.off("file_uploaded", onFileUploaded);
    };
  }, [socket, projectId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setLoading(true);
        const uploaded = await uploadFile(projectId, file);
        setFiles(prev => [uploaded, ...prev]);
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setLoading(false);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold font-mono text-white tracking-tight">Files</h2>
        <button 
           onClick={handleUploadClick}
           disabled={loading}
           className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            )}
            Upload File
        </button>
        <input 
           type="file" 
           ref={fileInputRef} 
           className="hidden" 
           onChange={handleFileChange}
        />
      </div>

      <div className="flex-1 bg-[#0b0c10] border border-gray-800 rounded-xl overflow-hidden shadow-sm min-h-[500px] relative">
          {files.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                 <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-6 border border-gray-700">
                     <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2 font-mono">No files yet</h3>
                 <p className="text-gray-500 max-w-sm">Upload your first file to get started</p>
             </div>
          ) : (
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-[#161b22] text-gray-400 font-mono text-xs uppercase border-b border-gray-800">
                         <tr>
                             <th className="px-6 py-4 font-medium">Name</th>
                             <th className="px-6 py-4 font-medium">Size</th>
                             <th className="px-6 py-4 font-medium">Uploaded By</th>
                             <th className="px-6 py-4 font-medium">Date</th>
                             <th className="px-6 py-4 font-medium text-right">Action</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800">
                         {files.map(file => (
                             <tr key={file._id} className="hover:bg-white/5 transition-colors group">
                                 <td className="px-6 py-4">
                                     <div className="flex items-center gap-3">
                                         <span className="p-2 rounded bg-gray-800 text-gray-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                         </span>
                                         <span className="font-medium text-gray-200 font-mono group-hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => window.open(file.url, '_blank')}>{file.filename}</span>
                                     </div>
                                 </td>
                                 <td className="px-6 py-4 text-gray-500 font-mono text-xs">{formatSize(file.size)}</td>
                                 <td className="px-6 py-4">
                                     <div className="flex items-center gap-2">
                                         <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white">
                                             {file.uploaderId?.name?.[0] || "?"}
                                         </div>
                                         <span className="text-gray-400 text-xs">{file.uploaderId?.name}</span>
                                     </div>
                                 </td>
                                 <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                     {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                     <a 
                                        href={file.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-indigo-400 hover:text-indigo-300 text-xs font-mono"
                                     >
                                         Download
                                     </a>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
          )}
      </div>
    </div>
  );
};

export default FilesView;
