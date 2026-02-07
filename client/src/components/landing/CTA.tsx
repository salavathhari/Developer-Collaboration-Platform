import { useNavigate } from "react-router-dom";

const CTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-32 px-8 relative bg-[#0a0e1a]">
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="relative bg-gradient-to-br from-[#1a1f35] to-[#0d1117] rounded-2xl p-16 border border-[#21262d]">
          <div className="relative z-10 text-center">
            {/* Icon */}
            <div className="inline-block mb-8">
              <svg
                className="w-16 h-16 text-[#6366f1]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">
              Ready to Collaborate?
            </h2>
            
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-light">
              Join thousands of developers building better software together.
            </p>
            
            <button
              onClick={() => navigate("/signup")}
              className="px-12 py-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-lg font-semibold rounded-lg hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-200"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
