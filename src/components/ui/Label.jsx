import React from 'react';

export const Label = ({ children, className = '', ...props }) => {
    return (
        <label className={`cyber-label ${className}`} {...props}>
            {children}
        </label>
    );
};
