import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-8 overflow-hidden bg-gradient-to-b from-[#1a1f35] via-[#0a0e1a] to-[#0a0e1a]">
      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center pt-20">
        <h1 className="text-7xl md:text-8xl lg:text-[7rem] font-bold text-white mb-8 leading-[1.1] tracking-tight">
          Build Better,{" "}
          <br />
          <span className="bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#8b5cf6] bg-clip-text text-transparent">
            Together
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
          The all-in-one collaboration platform for developers. Manage projects,
          communicate in real-time, and leverage AI assistance.
        </p>
        
        <button
          onClick={() => navigate("/signup")}
          className="px-12 py-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-lg font-semibold rounded-lg hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-200"
        >
          Start Building
        </button>
      </div>
    </section>
  );
};

export default Hero;
