import React, { useState, useEffect } from "react";
import { Mail, AlertCircle, Check } from "lucide-react";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  name?: string;
  autoComplete?: string;
}

const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChange,
  placeholder = "name@company.com",
  error,
  required = false,
  name = "email",
  autoComplete = "email",
}) => {
  const [touched, setTouched] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  useEffect(() => {
    if (touched && value) {
      setIsValid(validateEmail(value));
    } else {
      setIsValid(null);
    }
  }, [value, touched]);

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Mail
          size={20}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="email"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`w-full pl-11 pr-11 py-3 bg-zinc-800 border ${
            error
              ? "border-red-500"
              : isValid === false
              ? "border-yellow-500"
              : isValid === true
              ? "border-green-500"
              : "border-zinc-700"
          } rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all`}
          aria-label="Email"
          aria-describedby={error ? "email-error" : undefined}
          aria-invalid={!!error || isValid === false}
        />
        {isValid === true && (
          <Check
            size={20}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
          />
        )}
        {isValid === false && !error && (
          <AlertCircle
            size={20}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500"
          />
        )}
      </div>

      {error && (
        <div
          id="email-error"
          className="flex items-center gap-2 text-red-400 text-sm"
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {isValid === false && !error && touched && (
        <p className="text-yellow-400 text-sm">
          Please enter a valid email address
        </p>
      )}
    </div>
  );
};

export default EmailInput;
