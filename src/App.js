// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
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

  // Memoize syncNotes to prevent recreating it
  const syncNotes = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    
    setSyncStatus('syncing');
    try {
      const result = await notesDB.syncWithFirebase(async (operation) => {
        console.log('Syncing operation:', operation);
      });
      
      setSyncStatus('synced');
      console.log('Sync completed:', result);
    } catch (error) {
      setSyncStatus('error');
      console.error('Sync failed:', error);
    }
  }, [user]);

  useEffect(() => {
    // Auth state listener
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        console.log('User logged in:', firebaseUser.uid);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
      } else {
        console.log('User logged out');
        setUser(null);
        encryptionService.clearMasterKey();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Separate useEffect for network status listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOffline(false);
      if (user) {
        syncNotes();
      }
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, syncNotes]);

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
      <div className="App">
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading Secure Notes...</p>
        </div>
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
              📵 You're offline. Changes will sync when you reconnect.
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
              path="/notes/:id" 
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