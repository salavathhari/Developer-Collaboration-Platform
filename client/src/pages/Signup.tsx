import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "Name is required.";
    if (!isValidEmail(form.email)) return "Enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
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
      await signup(form);
      setSuccess("Account created. Redirecting to sign in...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError("Email already exists. Please sign in.");
      } else {
        const message = err?.response?.data?.message || "Signup failed.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#050505] text-white overflow-hidden font-sans">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 xl:px-32 py-12 lg:py-0 z-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 cursor-pointer mb-12" onClick={() => navigate("/")}>
            <span className="text-2xl font-bold text-indigo-500">&lt;/&gt;</span>
            <span className="text-xl font-bold font-mono text-white tracking-tight">DevCollab</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Get Started</h1>
          <p className="text-gray-400 text-lg">Create your account and start collaborating</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm">
              {success}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 block tracking-wide">Full Name</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full bg-[#1A1A1A] border border-gray-800 text-gray-200 text-sm rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 placeholder-gray-600 transition-all outline-none hover:bg-[#222]"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 block tracking-wide">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-[#1A1A1A] border border-gray-800 text-gray-200 text-sm rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 placeholder-gray-600 transition-all outline-none hover:bg-[#222]"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 block tracking-wide">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full bg-[#1A1A1A] border border-gray-800 text-gray-200 text-sm rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 placeholder-gray-600 transition-all outline-none hover:bg-[#222]"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white bg-[#6366f1] hover:bg-[#5558e0] font-semibold rounded-md text-base px-5 py-3 text-center transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:cursor-not-allowed mt-6 transform active:scale-[0.99]"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="text-center pt-2 text-sm">
            <span className="text-gray-500 font-light">Already have an account? </span>
            <Link to="/login" className="font-medium text-[#6366f1] hover:text-[#8183ff] hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#000000] items-center justify-center overflow-hidden border-l border-white/5">
         
         {/* Background Elements */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/10 rounded-full blur-[120px]"></div>

         {/* Content container */}
         <div className="relative z-10 w-full max-w-2xl px-12 flex flex-col items-center">
            
            {/* Visual element representing code/collaboration */}
            <div className="relative w-full max-w-[400px] aspect-square mb-12 flex items-center justify-center">
               
               {/* Simplified Code Block Visual (Abstract) */}
                <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-black to-gray-900 rounded-2xl border border-gray-800 shadow-2xl p-8 opacity-80 rotate-3 transform hover:rotate-0 transition-transform duration-700">
                    <div className="flex gap-2 mb-6">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                    </div>
                    <div className="space-y-4 font-mono text-sm">
                        <div className="h-2 bg-gray-800 rounded w-1/3"></div>
                        <div className="h-2 bg-gray-800 rounded w-2/3"></div>
                        <div className="h-2 bg-indigo-900/50 rounded w-1/2"></div>
                        <div className="h-2 bg-gray-800 rounded w-3/4"></div>
                         <div className="h-2 bg-gray-800 rounded w-1/4"></div>
                    </div>
                </div>
                 
                 {/* Foreground Text Visual */}
                 <div className="absolute -bottom-4 right-0 bg-[#0d1117] border border-gray-700 p-4 rounded-lg shadow-xl animate-bounce delay-1000 duration-[3000ms]">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-mono text-gray-300">Build completed in 420ms</span>
                    </div>
                 </div>

            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4 font-mono tracking-tight leading-tight">
                Join Thousands of <br/>
                <span className="text-white">Developers</span>
            </h2>
            <p className="text-gray-400 text-lg text-center font-light max-w-sm mx-auto leading-relaxed">
                Start your journey with the most powerful collaboration platform built for engineering teams.
            </p>
         </div>
      </div>
    </div>
  );
};

export default Signup;
