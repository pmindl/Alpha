import React, { memo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';

const Sidebar = memo(function Sidebar() {
    // Theme state
    const { isDark, toggleTheme } = useTheme();

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <Panel variant="sidebar">
            {/* Brand */}
            <Button variant="icon" style={{ marginBottom: '8px', color: 'var(--accent-primary)', cursor: 'default', border: 'none', background: 'transparent' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
            </Button>

            {/* Tools */}
            <Button variant="icon" onDragStart={(event) => onDragStart(event, 'input')} draggable title="Input Node">I</Button>
            <Button variant="icon" onDragStart={(event) => onDragStart(event, 'default')} draggable title="Processor Node">P</Button>
            <Button variant="icon" onDragStart={(event) => onDragStart(event, 'output')} draggable title="Output Node">O</Button>

            <div style={{ width: '40px', height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

            <Button variant="icon" active={true} onDragStart={(event) => onDragStart(event, 'agent')} draggable title="AI Agent Node">AI</Button>

            <div style={{ flex: 1 }} />

            {/* Theme Toggle */}
            <Button variant="icon" className="clickable" onClick={toggleTheme} title="Toggle Theme">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
        </Panel>
    );
});

export default Sidebar;
