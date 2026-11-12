import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  hint,
  error,
  children,
}) => {
  return (
    <div style={{ marginBottom: '14px', width: '100%' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          color: '#344054',
          marginBottom: '5px',
        }}
      >
        {label} {required && <span style={{ color: '#df2b1a' }}>*</span>}
      </label>

      {children}

      {hint && !error && (
        <span style={{ display: 'block', fontSize: '11px', color: '#667085', marginTop: '4px' }}>
          {hint}
        </span>
      )}

      {error && (
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            color: '#b42318',
            fontWeight: 500,
            marginTop: '4px',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
