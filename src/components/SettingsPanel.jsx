import React from 'react';
import { MODEL_OPTIONS } from '../lib/schema';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';
import { Input, TextArea } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';

const SettingsPanel = ({ selectedNode, setNodes, setSelectedNode }) => {
    // If no node is selected, render placeholder
    if (!selectedNode) {
        return (
            <Panel variant="glass" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', opacity: 0.3 }}>
                    <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>System Ready</p>
                </div>
            </Panel>
        );
    }

    // Helper to update node data safely
    const handleChange = (field, value) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNode.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            [field]: value,
                        },
                    };
                }
                return node;
            })
        );
    };

    return (
        <Panel variant="glass">
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h2 style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '1px', margin: 0 }}>
                    NODE CONFIG
                </h2>
                <Button variant="icon" style={{ width: '24px', height: '24px' }} onClick={() => setSelectedNode(null)} title="Close">
                    ✕
                </Button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                {/* Identity Section */}
                <div style={{ marginBottom: '24px' }}>
                    <Label>Node ID</Label>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--accent-primary)',
                        marginBottom: '12px',
                        opacity: 0.8
                    }}>
                        {selectedNode.id}
                    </div>

                    <Label>Label</Label>
                    <Input
                        type="text"
                        value={selectedNode.data.label || ''}
                        onChange={(e) => handleChange('label', e.target.value)}
                    />
                </div>

                <div style={{ height: '1px', background: 'var(--border-subtle)', marginBottom: '24px' }} />

                {/* AI Parameters (Conditional) */}
                {selectedNode.data.type === 'agent' && (
                    <>
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>AI LOGIC</span>
                                <span style={{ fontSize: '9px', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: '4px' }}>ACTIVE</span>
                            </div>

                            <Label>System Prompt</Label>
                            <TextArea
                                style={{ minHeight: '120px', resize: 'vertical', marginBottom: '16px', lineHeight: '1.4' }}
                                value={selectedNode.data.systemPrompt || ''}
                                onChange={(e) => handleChange('systemPrompt', e.target.value)}
                                placeholder="Define the behavior of this agent..."
                            />

                            <Label>Model</Label>
                            <Select
                                style={{ marginBottom: '16px' }}
                                value={selectedNode.data.model || 'gpt-4-turbo'}
                                onChange={(e) => handleChange('model', e.target.value)}
                            >
                                {MODEL_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </Select>

                            <Label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Temperature</span>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedNode.data.temperature || 0.7}</span>
                            </Label>
                            <input
                                type="range"
                                min="0" max="1" step="0.1"
                                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                                value={selectedNode.data.temperature || 0.7}
                                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                            />
                        </div>
                    </>
                )}

            </div>

            {/* Footer */}
            <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <Button>
                    SAVE
                </Button>
            </div>

        </Panel>
    );
};

export default SettingsPanel;
