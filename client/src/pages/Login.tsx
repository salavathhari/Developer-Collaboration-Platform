import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { acceptInvite } from "../services/projectService";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!isValidEmail(form.email)) return "Enter a valid email address.";
    if (!form.password) return "Password is required.";
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      await login(form);

      const pendingInvite = localStorage.getItem("pendingInviteToken");
      if (pendingInvite) {
        try {
          await acceptInvite(pendingInvite);
          localStorage.removeItem("pendingInviteToken");
        } catch {
          localStorage.removeItem("pendingInviteToken");
        }
      }

      setSuccess("Signed in. Redirecting...");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        const message = err?.response?.data?.message || "Login failed.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#050505] text-white overflow-hidden font-sans">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 py-12 lg:py-0 z-10 transition-all duration-500">
        <div className="mb-10">
          <div className="flex items-center gap-3 cursor-pointer mb-12" onClick={() => navigate("/")}>
            <span className="text-2xl font-bold text-indigo-500">&lt;/&gt;</span>
            <span className="text-xl font-bold font-mono text-white tracking-tight">DevCollab</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Welcome Back</h1>
          <p className="text-gray-400 text-lg">Sign in to continue to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
           {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm animate-fade-in">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm animate-fade-in">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300 block tracking-wide">Email</label>
            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-[#161b22] border border-[#30363d] text-gray-200 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 block pl-11 p-3.5 placeholder-gray-600 transition-all outline-none"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300 block tracking-wide">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full bg-[#161b22] border border-[#30363d] text-gray-200 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 block pl-11 p-3.5 placeholder-gray-600 transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white bg-[#6366f1] hover:bg-[#5558e0] font-semibold rounded-lg text-base px-5 py-3.5 text-center transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed mt-8 transform active:scale-[0.99]"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          <p className="text-center pt-4 text-sm">
            <span className="text-gray-500">Don't have an account? </span>
            <Link to="/signup" className="font-medium text-[#6366f1] hover:text-[#8183ff] hover:underline transition-colors">
              Sign up
            </Link>
          </p>
        </form>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#010101] items-center justify-center overflow-hidden border-l border-white/5">
        {/* Ambient Glow */}
        <div className="absolute right-0 bottom-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px] translate-y-1/3 translate-x-1/3"></div>

         <div className="relative z-10 w-full max-w-2xl px-12 flex flex-col items-center">
            
            {/* Code/Visual Block */}
            <div className="relative w-full max-w-lg mb-12 perspective-[2000px] group">
                {/* Floating Elements */}
                 <div className="absolute -top-6 -right-6 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                 
                 {/* Main Code Window */}
                 <div className="relative bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden transform group-hover:rotate-x-2 group-hover:rotate-y-2 transition-transform duration-500">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
                        <div className="flex gap-2">
                             <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                             <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                             <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">collaborate.tsx</div>
                    </div>
                    {/* Code Content */}
                    <div className="p-6 space-y-3 opacity-90">
                        <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">1</span>
                            <div className="text-sm font-mono text-purple-400">const <span className="text-blue-400">innovation</span> = <span className="text-white">await</span> <span className="text-yellow-400">team</span>.<span className="text-indigo-400">collaborate</span>(<span className="text-white">ideas</span>);</div>
                        </div>
                         <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">2</span>
                             <div className="text-sm font-mono text-gray-400"><span className="text-gray-500">// Real-time sync enabled</span></div>
                        </div>
                        <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">3</span>
                             <div className="text-sm font-mono text-purple-400">if <span className="text-white">(</span><span className="text-blue-400">innovation</span>.<span className="text-indigo-400">isReady</span><span className="text-white">()) {`{`}</span></div>
                        </div>
                        <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">4</span>
                             <div className="text-sm font-mono text-indigo-400 pl-4">shipIt<span className="text-white">();</span></div>
                        </div>
                         <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">5</span>
                             <div className="text-sm font-mono text-white">{'}'}</div>
                        </div>
                         <div className="flex">
                            <span className="text-gray-600 mr-4 select-none">6</span>
                             <div className="text-sm font-mono text-gray-400"> </div>
                        </div>
                    </div>
                    {/* Gradient Overlay */}
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent opacity-50"></div>
                 </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-center text-white mb-6 font-mono tracking-tight leading-tight">
                Build Amazing <br/>
                <span className="text-white">Things</span>
            </h2>
            <p className="text-gray-400 text-lg text-center font-light max-w-md leading-relaxed">
                Collaborate with your team in real-time with powerful tools designed for modern development.
            </p>
         </div>
      </div>
    </div>
  );
};

export default Login;
