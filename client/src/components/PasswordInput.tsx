import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrengthMeter?: boolean;
  error?: string;
  required?: boolean;
  name?: string;
  autoComplete?: string;
}

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

const calculatePasswordStrength = (password: string): PasswordStrength => {
  let score = 0;

  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

  if (score <= 2) {
    return { score: 1, label: "Weak", color: "bg-red-500" };
  } else if (score === 3) {
    return { score: 2, label: "Medium", color: "bg-yellow-500" };
  } else {
    return { score: 3, label: "Strong", color: "bg-green-500" };
  }
};

const getPasswordRequirements = (password: string) => {
  return [
    {
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "One number",
      met: /[0-9]/.test(password),
    },
    {
      label: "One special character",
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
  ];
};

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder = "Enter password",
  showStrengthMeter = false,
  error,
  required = false,
  name = "password",
  autoComplete = "current-password",
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const strength = showStrengthMeter ? calculatePasswordStrength(value) : null;
  const requirements = showStrengthMeter ? getPasswordRequirements(value) : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full px-4 py-3 pr-12 bg-zinc-800 border ${
            error ? "border-red-500" : "border-zinc-700"
          } rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
          aria-label="Password"
          aria-describedby={error ? "password-error" : undefined}
          aria-invalid={!!error}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1"
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          id="password-error"
          className="flex items-center gap-2 text-red-400 text-sm"
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Password Strength Meter */}
      {showStrengthMeter && value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    strength && strength.score >= level
                      ? strength.color
                      : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
            {strength && strength.label && (
              <span
                className={`text-sm font-medium ${
                  strength.score === 1
                    ? "text-red-400"
                    : strength.score === 2
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {strength.label}
              </span>
            )}
          </div>

          {/* Requirements List (shown on focus or if not all met) */}
          {(isFocused || requirements.some((r) => !r.met)) && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-1">
              <p className="text-xs text-zinc-400 mb-2">
                Password must contain:
              </p>
              {requirements.map((req, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs"
                >
                  {req.met ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />
                  )}
                  <span
                    className={req.met ? "text-green-400" : "text-zinc-400"}
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
