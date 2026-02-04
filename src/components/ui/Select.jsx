import React from 'react';

export const Select = ({ children, className = '', ...props }) => {
    return (
        <select className={`cyber-input ${className}`} {...props}>
            {children}
        </select>
    );
};
