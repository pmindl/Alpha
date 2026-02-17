import React from 'react';

export const Button = ({ children, variant = 'primary', active = false, className = '', ...props }) => {
    let baseClass = 'cyber-button';

    if (variant === 'icon') {
        baseClass = `icon-btn ${active ? 'active' : ''}`;
    }

    return (
        <button className={`${baseClass} ${className}`} {...props}>
            {children}
        </button>
    );
};
