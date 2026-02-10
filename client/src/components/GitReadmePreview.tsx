import { useEffect, useState } from 'react';
import { getFileContent } from '../services/gitRepoService';
import ReactMarkdown from 'react-markdown';
import { Book } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface GitReadmePreviewProps {
    projectId: string;
    branch: string;
}

const GitReadmePreview: React.FC<GitReadmePreviewProps> = ({ projectId, branch }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        loadReadme();
    }, [projectId, branch]);

    const loadReadme = async () => {
        try {
            setLoading(true);
            setError(false);
            const data = await getFileContent(projectId, 'README.md', branch);
            setContent(data.content);
        } catch (err) {
            console.error('Failed to load README:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-6 mb-6">
                <div className="border border-gray-700 rounded-md overflow-hidden">
                    <div className="bg-[#161b22] px-4 py-2 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <Book className="w-4 h-4 text-gray-400" />
                            <span className="text-white font-semibold text-sm">README.md</span>
                        </div>
                    </div>
                    <div className="bg-[#0d1117] px-6 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return null; // Don't show anything if README not found
    }

    return (
        <div className="mx-6 mb-6">
            <div className="border border-gray-700 rounded-md overflow-hidden">
                <div className="bg-[#161b22] px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Book className="w-4 h-4 text-gray-400" />
                        <span className="text-white font-semibold text-sm">README.md</span>
                    </div>
                    <span className="text-xl">📖</span>
                </div>
                <div className="bg-[#0d1117] px-6 py-6">
                    <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isInline = !match;
                                    
                                    return !isInline && match ? (
                                        <SyntaxHighlighter
                                            style={vscDarkPlus as any}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{
                                                margin: '1em 0',
                                                borderRadius: '6px',
                                            }}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-pink-400">
                                            {children}
                                        </code>
                                    );
                                },
                                h1: ({ children }) => (
                                    <h1 className="text-3xl font-bold text-white mb-4 pb-2 border-b border-gray-800">
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-gray-800">
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-xl font-bold text-white mt-5 mb-2">
                                        {children}
                                    </h3>
                                ),
                                p: ({ children }) => (
                                    <p className="text-gray-300 mb-4 leading-relaxed">
                                        {children}
                                    </p>
                                ),
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        className="text-[#58a6ff] hover:underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {children}
                                    </a>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
                                        {children}
                                    </ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">
                                        {children}
                                    </ol>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-gray-600 pl-4 text-gray-400 italic my-4">
                                        {children}
                                    </blockquote>
                                ),
                                table: ({ children }) => (
                                    <div className="overflow-x-auto my-4">
                                        <table className="min-w-full border border-gray-700">
                                            {children}
                                        </table>
                                    </div>
                                ),
                                thead: ({ children }) => (
                                    <thead className="bg-[#161b22]">{children}</thead>
                                ),
                                th: ({ children }) => (
                                    <th className="border border-gray-700 px-4 py-2 text-left text-white font-semibold">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="border border-gray-700 px-4 py-2 text-gray-300">
                                        {children}
                                    </td>
                                ),
                                hr: () => <hr className="border-gray-800 my-6" />,
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GitReadmePreview;
