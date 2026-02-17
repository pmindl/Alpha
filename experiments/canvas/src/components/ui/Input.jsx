import React from 'react';

export const Input = ({ className = '', ...props }) => {
    return (
        <input className={`cyber-input ${className}`} {...props} />
    );
};

export const TextArea = ({ className = '', ...props }) => {
    return (
        <textarea className={`cyber-input ${className}`} {...props} />
    );
};
