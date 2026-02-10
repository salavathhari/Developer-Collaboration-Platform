import React, { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  heroTitle = "Build. Collaborate. Ship.",
  heroSubtitle = "The modern developer platform for teams that move fast",
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-purple-900/20 flex">
      {/* Left Column - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <img
              src="/logo.png"
              alt="DevCollab"
              className="h-12 mx-auto mb-8"
            />
            <h2 className="text-3xl font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
            )}
          </div>

          {/* Form */}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Right Column - Hero (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-purple-900/40 to-zinc-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

        <div className="relative z-10 max-w-lg space-y-8 text-center">
          {/* Hero Illustration */}
          <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow"></div>

            <svg
              className="w-64 h-64 mx-auto relative z-10"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Code window */}
              <rect
                x="20"
                y="40"
                width="160"
                height="120"
                rx="8"
                fill="#27272a"
                stroke="#8b5cf6"
                strokeWidth="2"
              />
              <rect
                x="20"
                y="40"
                width="160"
                height="20"
                rx="8"
                fill="#8b5cf6"
              />
              <circle cx="32" cy="50" r="3" fill="#fff" />
              <circle cx="42" cy="50" r="3" fill="#fff" />
              <circle cx="52" cy="50" r="3" fill="#fff" />

              {/* Code lines */}
              <line
                x1="35"
                y1="75"
                x2="100"
                y2="75"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="90"
                x2="130"
                y2="90"
                stroke="#a78bfa"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="105"
                x2="85"
                y2="105"
                stroke="#c4b5fd"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="120"
                x2="115"
                y2="120"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="135"
                x2="95"
                y2="135"
                stroke="#a78bfa"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Checkmark */}
              <circle cx="160" cy="140" r="22" fill="#10b981" />
              <path
                d="M150 140 L157 147 L170 133"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {/* Hero Text */}
          <div>
            <h3 className="text-3xl font-bold text-white mb-3">
              {heroTitle}
            </h3>
            <p className="text-zinc-400 text-lg">{heroSubtitle}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .bg-grid-pattern {
          background-image: linear-gradient(
              rgba(139, 92, 246, 0.1) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(139, 92, 246, 0.1) 1px,
              transparent 1px
            );
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;
