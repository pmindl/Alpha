import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import NodeEditor from './NodeEditor';

// Storage for captured props
let miniMapRenderCount = 0;
let nodeColorPropsHistory = [];

vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        ReactFlowProvider: ({ children }) => <div>{children}</div>,
        ReactFlow: ({ children, onPaneClick }) => (
            <div>
                <button data-testid="pane-click" onClick={onPaneClick}>Pane Click</button>
                {children}
            </div>
        ),
        MiniMap: (props) => {
            miniMapRenderCount++;
            nodeColorPropsHistory.push(props.nodeColor);
            return <div data-testid="minimap">MiniMap</div>;
        },
        Controls: () => null,
        Background: () => null,
    };
});

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('NodeEditor Performance', () => {
    beforeEach(() => {
        miniMapRenderCount = 0;
        nodeColorPropsHistory = [];
    });

    it('preserves nodeColor callback reference on re-render (optimization verified)', () => {
        const { rerender } = render(<NodeEditor />);

        // Initial render check
        expect(miniMapRenderCount).toBe(1);
        const firstRenderColorFn = nodeColorPropsHistory[0];

        // Force a re-render
        rerender(<NodeEditor />);

        // Verify we re-rendered
        expect(miniMapRenderCount).toBe(2);
        const secondRenderColorFn = nodeColorPropsHistory[1];

        // ASSERTION: PROVE THE OPTIMIZATION
        // The function reference should be THE SAME on the second render
        expect(secondRenderColorFn).toBe(firstRenderColorFn);
    });
});
