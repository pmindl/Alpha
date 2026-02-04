import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Sidebar from './Sidebar';
import SettingsPanel from './SettingsPanel';
import { createNode, NODE_TYPES } from '../lib/schema';
// CSS imported globally in main.jsx

const initialNodes = [
    createNode('1', NODE_TYPES.INPUT, { x: 250, y: 5 })
];

let id = 0;
const getId = () => `dndnode_${id++}`;

const NodeEditor = () => {
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = createNode(getId(), type, position);

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    // Selection handling
    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // Update selectedNode if the real node data changes
    const activeNode = nodes.find(n => n.id === selectedNode?.id) || null;

    return (
        <div className="dndflow" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <ReactFlowProvider>

                {/* Sidebar (Left) */}
                <Sidebar />

                {/* Canvas Area */}
                <div className="reactflow-wrapper" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        fitView
                    >
                        <Controls className="controls-override" />
                        <Background color="var(--bg-dots)" gap={20} size={1} />
                        <MiniMap
                            className="minimap-override"
                            nodeColor={(n) => {
                                const type = n.data?.type || n.type;
                                if (type === 'input') return '#3b82f6';
                                if (type === 'output') return '#ec4899';
                                if (type === 'agent') return '#a855f7';
                                return '#64748b';
                            }}
                        />
                    </ReactFlow>
                </div>

                {/* Settings Panel (Right Floating) */}
                <SettingsPanel
                    selectedNode={activeNode}
                    setNodes={setNodes}
                    setSelectedNode={setSelectedNode}
                />

            </ReactFlowProvider>
        </div>
    );
};

export default NodeEditor;
