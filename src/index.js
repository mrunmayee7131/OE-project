import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// DISABLED: Service worker causing issues
// import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// DISABLED: Service worker for offline functionality
// The app will still work, but won't have offline caching via service worker
// Offline functionality is still available through IndexedDB
// serviceWorkerRegistration.register();

// Optional: Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}