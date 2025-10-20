import React from 'react';
import './Layout.css';

function Header({ user, onLogout, isOffline, syncStatus }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          🔐 Secure Notes
        </div>
        
        <nav className="header-nav">
          {user && (
            <div className="user-info">
              <span>👤 {user.displayName || user.email}</span>
              
              <div className={`sync-indicator ${syncStatus}`}>
                {syncStatus === 'syncing' && '🔄 Syncing...'}
                {syncStatus === 'synced' && '✓ Synced'}
                {syncStatus === 'error' && '⚠️ Sync Error'}
                {isOffline && '📵 Offline'}
              </div>
              
              <button onClick={onLogout} className="logout-btn">
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;