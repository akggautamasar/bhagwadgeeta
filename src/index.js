import React from 'react';
import ReactDOM from 'react-dom/client'; // For React 18+
import './index.css'; // Import your main CSS file
import App from './App'; // Import the main App component

// Get the root element from public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component into the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
