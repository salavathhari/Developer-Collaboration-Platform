import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const TopBar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-[#050505] border-b border-white/5">
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => navigate("/")}
      >
        <div className="text-indigo-500">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 12L5 15L2 12M22 12L19 15L16 12M5 9L8 6L11 9M16 9L19 6L22 9M11 15L14 18L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-lg font-bold font-mono text-white tracking-tight">DevCollab</span>
      </div>

      <button 
        onClick={logout}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Logout
      </button>
    </header>
  );
};

export default TopBar;
