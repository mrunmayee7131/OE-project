// src/components/Layout/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header({ user, onLogout, isOffline, syncStatus }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <Link to="/">
            <h1>🔐 Secure Notes</h1>
          </Link>
        </div>

        {user && (
          <div className="header-nav">
            <div className="user-info">
              {isOffline && (
                <span className="offline-indicator">📵 Offline</span>
              )}
              
              {!isOffline && syncStatus && (
                <span className={`sync-indicator ${syncStatus}`}>
                  {syncStatus === 'synced' && '✓ Synced'}
                  {syncStatus === 'syncing' && '↻ Syncing...'}
                  {syncStatus === 'error' && '⚠ Sync Error'}
                </span>
              )}

              <span className="user-email">{user.email}</span>
            </div>

            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;