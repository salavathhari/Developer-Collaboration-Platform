import { useState } from "react";
import type { Project } from "../types";
import { queryAi } from "../services/aiService";

const AiAssistant = ({ project }: { project: Project }) => {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  // This would be your real user ID logic or extracted from auth context if needed for something specific
  // For standard usage, project._id is enough.
  const projectId = project._id;

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setResponse(""); // clear previous response while loading? or keep it? Design implies new state.
    
    try {
      // Combine prompt and context if context exists
      const fullPrompt = context.trim() 
        ? `Context: ${context}\n\nQuestion: ${prompt}`
        : prompt;

      const result = await queryAi({
        prompt: fullPrompt,
        projectId,
        // provider: "openai" // Removed to allow backend to use default provider (local/Ollama)
      });
      
      setResponse(result.response);
    } catch (err) {
      console.error(err);
      setResponse("Sorry, I encountered an error providing a response.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === "summarize") {
        setPrompt("Please summarize the recent team chat discussions and highlight any key decisions or action items.");
        setContext("");
    } else if (action === "review") {
        setPrompt("Please provide a code review template for a React TypeScript component, focusing on performance, accessibility, and type safety.");
        setContext("");
    }
  };

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-mono text-white tracking-tight flex items-center gap-3">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </span>
            AI Assistant
        </h2>
        <p className="text-sm text-gray-500 font-mono pl-11">Powered by Ollama (Local)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
         {/* Left Column - Input */}
         <div className="flex flex-col gap-6">
            
            {/* Ask AI Card */}
            <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6">
               <h3 className="text-lg font-bold text-white font-mono mb-6">Ask AI</h3>
               
               <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-gray-400 mb-2 font-mono uppercase tracking-wider">Your Question</label>
                      <textarea 
                          className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono text-sm h-32 resize-none"
                          placeholder="Ask for code suggestions, bug detection, or technical guidance..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                      />
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-gray-400 mb-2 font-mono uppercase tracking-wider">Context (Optional)</label>
                      <textarea 
                          className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono text-sm h-24 resize-none"
                          placeholder="Provide code snippets or additional context..."
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                      />
                  </div>
                  
                  <button 
                      onClick={handleAsk}
                      disabled={loading || !prompt.trim()}
                      className="w-full bg-[#6366f1] hover:bg-[#5558e0] disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
                  >
                      {loading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Thinking...
                          </>
                      ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            Ask AI
                          </>
                      )}
                  </button>
               </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white font-mono mb-4">Quick Actions</h3>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => handleQuickAction('summarize')}
                        className="w-full text-left px-4 py-3 bg-[#161b22] hover:bg-[#1c2128] border border-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-3 group"
                    >
                         <svg className="w-4 h-4 text-gray-500 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                         <span className="font-mono text-sm">Summarize Team Chat</span>
                    </button>
                    <button 
                        onClick={() => handleQuickAction('review')}
                        className="w-full text-left px-4 py-3 bg-[#161b22] hover:bg-[#1c2128] border border-gray-800 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-3 group"
                    >
                         <svg className="w-4 h-4 text-gray-500 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                         <span className="font-mono text-sm">Code Review Template</span>
                    </button>
                </div>
            </div>

         </div>

         {/* Right Column - Response */}
         <div className="flex flex-col h-full bg-[#0b0c10] border border-gray-800 rounded-xl overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-800">
                 <h3 className="text-lg font-bold text-white font-mono">AI Response</h3>
             </div>
             
             <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                 {response ? (
                     <div className="prose prose-invert max-w-none prose-pre:bg-[#111] prose-pre:border prose-pre:border-gray-800">
                         {/* Simple rendering for now, could use a Markdown renderer */}
                         {response.split('\n').map((line, i) => (
                             <p key={i} className={`text-gray-300 font-mono text-sm mb-2 ${line.startsWith('-') ? 'pl-4' : ''}`}>
                                 {line}
                             </p>
                         ))}
                     </div>
                 ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-40">
                         <svg className="w-12 h-12 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         <p className="text-gray-400 font-mono text-sm">AI response will appear here</p>
                     </div>
                 )}
             </div>
         </div>
      </div>
    </div>
  );
};

export default AiAssistant;
