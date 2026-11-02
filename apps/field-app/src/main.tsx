import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App.js';
import { initProfiles } from './app/initProfiles.js';
import './styles/index.css';

initProfiles();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/splice-app">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
