import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import NodeEditor from './NodeEditor';
import { ReactFlowProvider } from 'reactflow';

// Mock ReactFlow to avoid canvas issues in jsdom
vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        default: ({ children }) => <div>{children}</div>,
        ReactFlowProvider: ({ children }) => <div>{children}</div>,
        Controls: () => <div>Controls</div>,
        Background: () => <div>Background</div>,
        MiniMap: () => <div>MiniMap</div>,
    };
});

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('NodeEditor Component', () => {
    it('renders without crashing', () => {
        render(
            <ReactFlowProvider>
                <NodeEditor />
            </ReactFlowProvider>
        );

        // Check for Sidebar buttons
        expect(screen.getByTitle('Input Node')).toBeInTheDocument();
        expect(screen.getByTitle('AI Agent Node')).toBeInTheDocument();

        // Settings panel starts hidden/placeholder if no node is selected
        expect(screen.getByText('System Ready')).toBeInTheDocument();
    });
});
