import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationsBell from "./NotificationsBell";
import logo from "../assets/devcollablogo-removebg-preview.png";

const TopBar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-[#050505] border-b border-white/5 sticky top-0 z-40 backdrop-blur-md bg-[#050505]/80">
      <div 
        className="flex items-center gap-3 cursor-pointer group" 
        onClick={() => navigate("/")}
      >
        <img
          src={logo}
          alt="DevCollab logo"
          className="h-7 w-7 object-contain"
        />
        <span className="text-xl font-bold font-mono text-white tracking-tight">DevCollab</span>
      </div>

      <div className="flex items-center gap-6">
        <NotificationsBell />
        
        <div className="h-6 w-px bg-gray-800" />
        
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
      </div>
    </header>
  );
};

export default TopBar;
