import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  error,
  style,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <input
        {...props}
        type={showPassword ? 'text' : 'password'}
        style={{
          width: '100%',
          height: '38px',
          borderRadius: '6px',
          border: error ? '1px solid #fda29b' : '1px solid #d0d5dd',
          padding: '0 38px 0 12px',
          fontSize: '13px',
          color: '#101828',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          ...style,
        }}
        onFocus={(e) => {
          if (!error) e.currentTarget.style.borderColor = '#175cd3';
        }}
        onBlur={(e) => {
          if (!error) e.currentTarget.style.borderColor = '#d0d5dd';
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '10px',
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          color: '#667085',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};
