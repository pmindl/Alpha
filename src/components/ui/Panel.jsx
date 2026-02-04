import React from 'react';

/**
 * Reusable Panel Component
 * Uses the 'glass-panel' or 'bg-card' styles.
 * 
 * @param {string} variant - 'glass' (floating) | 'sidebar' (solid/pinned)
 * @param {string} className - Additional classes
 */
export const Panel = ({ children, variant = 'glass', className = '', style = {}, ...props }) => {

    // Note: The original CSS classes (settings-panel, app-sidebar) handle positioning too.
    // For a generic panel, we might want to separate layout from visual style,
    // but for now, we'll map variant to the existing consolidated classes to maintain exact look.

    // If variant is 'glass', we use the floating panel style
    // If variant is 'sidebar', we use the left sidebar style
    // If variant is 'card', we just apply background styles (future proofing)

    let finalClass = className;
    if (variant === 'glass') finalClass += ' settings-panel';
    if (variant === 'sidebar') finalClass += ' app-sidebar';

    return (
        <aside className={finalClass} style={style} {...props}>
            {children}
        </aside>
    );
};
