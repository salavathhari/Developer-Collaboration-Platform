import { useNavigate } from "react-router-dom";
import logo from "../../assets/devcollablogo-removebg-preview.png";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img
              src={logo}
              alt="DevCollab logo"
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-bold font-mono text-white tracking-tight">DevCollab</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/login")}
              className="text-white font-semibold text-sm hover:text-gray-300 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="px-5 py-2 bg-[#5d5dff] hover:bg-[#4b4be0] text-white text-sm font-semibold rounded-md transition-all sm:text-base"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
