// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/Layout/Header';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import NotesList from './components/Notes/NotesList';
import NoteEditor from './components/Notes/NoteEditor';
import { onAuthChange } from './services/firebase';
import encryptionService from './services/encryption';
import notesDB from './services/indexedDB';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('synced');

  useEffect(() => {
    // Auth state listener
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
      } else {
        setUser(null);
        encryptionService.clearMasterKey();
      }
      setLoading(false);
    });

    // Network status listeners
    const handleOnline = () => {
      setIsOffline(false);
      // Trigger sync when coming back online
      if (user) {
        syncNotes();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  const syncNotes = async () => {
    if (!navigator.onLine) return;
    
    setSyncStatus('syncing');
    try {
      // Sync logic would go here
      const result = await notesDB.syncWithFirebase(async (operation) => {
        // Handle each sync operation
        console.log('Syncing operation:', operation);
      });
      
      setSyncStatus('synced');
      console.log('Sync completed:', result);
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear local data
      if (user) {
        await notesDB.clearUserData(user.uid);
      }
      encryptionService.clearMasterKey();
      
      // Sign out from Firebase
      const { logoutUser } = await import('./services/firebase');
      await logoutUser();
      
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading secure notes...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Header 
          user={user} 
          onLogout={handleLogout}
          isOffline={isOffline}
          syncStatus={syncStatus}
        />
        
        <main className="main-content">
          {isOffline && (
            <div className="offline-banner">
              <span>📵 You're offline. Changes will sync when you reconnect.</span>
            </div>
          )}
          
          <Routes>
            <Route 
              path="/login" 
              element={
                !user ? <Login /> : <Navigate to="/notes" />
              } 
            />
            <Route 
              path="/register" 
              element={
                !user ? <Register /> : <Navigate to="/notes" />
              } 
            />
            <Route 
              path="/notes" 
              element={
                user ? <NotesList user={user} isOffline={isOffline} /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/notes/new" 
              element={
                user ? <NoteEditor user={user} isOffline={isOffline} /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/notes/edit/:id" 
              element={
                user ? <NoteEditor user={user} isOffline={isOffline} /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/" 
              element={<Navigate to={user ? "/notes" : "/login"} />} 
            />
          </Routes>
        </main>
        
        <footer className="app-footer">
          <p>🔒 End-to-End Encrypted • Zero-Knowledge Architecture</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;