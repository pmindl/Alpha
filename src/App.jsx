import React from 'react';
import NodeEditor from './components/NodeEditor';
import './index.css';

/**
 * App Component
 * 
 * Top-level wrapper for the application.
 */
function App() {
  return (
    <div className="app-container">
      <NodeEditor />
    </div>
  );
}

export default App;
