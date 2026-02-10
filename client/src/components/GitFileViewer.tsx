import { useEffect, useState } from 'react';
import { getFileContent, type RepoFile } from '../services/gitRepoService';
import { ArrowLeft, Download, Edit, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface GitFileViewerProps {
    projectId: string;
    file: RepoFile;
    branch: string;
    onBack: () => void;
}

const GitFileViewer: React.FC<GitFileViewerProps> = ({ projectId, file, branch, onBack }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [lines, setLines] = useState(0);

    useEffect(() => {
        loadFileContent();
    }, [projectId, file.path, branch]);

    const loadFileContent = async () => {
        try {
            setLoading(true);
            const data = await getFileContent(projectId, file.path, branch);
            setContent(data.content);
            setLines(data.content.split('\n').length);
        } catch (error) {
            console.error('Failed to load file content:', error);
            setContent('// Error loading file content');
        } finally {
            setLoading(false);
        }
    };

    const getLanguageFromPath = (path: string): string => {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'jsx',
            'ts': 'typescript',
            'tsx': 'tsx',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'scala': 'scala',
            'sh': 'bash',
            'bash': 'bash',
            'json': 'json',
            'xml': 'xml',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'md': 'markdown',
            'sql': 'sql',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'dockerfile': 'docker',
            'graphql': 'graphql',
        };
        return languageMap[ext] || 'text';
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0d1117]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading file...</p>
                </div>
            </div>
        );
    }

    const language = getLanguageFromPath(file.path);

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-white">
            {/* Header */}
            <div className="bg-[#161b22] border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-mono text-sm">{file.path}</span>
                                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                                    {language}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {lines} lines · {(content.length / 1024).toFixed(2)} KB
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        <button className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                            <Edit className="w-4 h-4" />
                            Edit
                        </button>
                    </div>
                </div>
            </div>

            {/* File Content with Syntax Highlighting */}
            <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        background: '#1e1e1e',
                    }}
                    lineNumberStyle={{
                        minWidth: '3em',
                        paddingRight: '1em',
                        color: '#858585',
                        textAlign: 'right',
                        userSelect: 'none',
                    }}
                >
                    {content}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

export default GitFileViewer;
