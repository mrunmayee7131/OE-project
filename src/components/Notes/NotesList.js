// src/components/Notes/NotesList.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNotes, deleteNote as deleteFirebaseNote } from '../../services/firebase';
import encryptionService from '../../services/encryption';
import notesDB from '../../services/indexedDB';
import NoteItem from './NoteItem';
import './Notes.css';

function NotesList({ user, isOffline }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user, isOffline]);

  const loadNotes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Loading notes for user:', user.uid);
      let encryptedNotes = [];
      
      if (isOffline) {
        // Load from IndexedDB when offline
        console.log('Loading from IndexedDB (offline)');
        encryptedNotes = await notesDB.getLocalNotes(user.uid);
      } else {
        // Load from Firebase when online
        console.log('Loading from Firebase (online)');
        encryptedNotes = await getNotes(user.uid);
        console.log('Loaded notes:', encryptedNotes.length);
        
        // Cache notes locally for offline access
        for (const note of encryptedNotes) {
          await notesDB.saveNoteLocally(note);
        }
      }

      // Decrypt notes for display
      const decryptedNotes = encryptedNotes.map(note => {
        if (note.encrypted) {
          try {
            return encryptionService.decryptNote(note);
          } catch (err) {
            console.error('Failed to decrypt note:', err);
            return {
              ...note,
              title: '[Unable to Decrypt]',
              content: 'Check your encryption password',
              decryptionError: true
            };
          }
        }
        return note;
      });

      console.log('Setting notes:', decryptedNotes.length);
      setNotes(decryptedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
      setError(error.message || 'Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      if (isOffline) {
        // Delete locally when offline
        await notesDB.deleteNoteLocally(noteId);
      } else {
        // Delete from Firebase
        await deleteFirebaseNote(user.uid, noteId);
        await notesDB.deleteNoteLocally(noteId);
      }
      
      // Update local state
      setNotes(notes.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      setError('Failed to delete note. Please try again.');
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="notes-container">
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-container">
      <div className="notes-header">
        <h1>📝 My Notes</h1>
        <Link to="/notes/new" className="new-note-btn">
          + New Note
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredNotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📔</div>
          <h2>No notes yet</h2>
          <p>Create your first encrypted note to get started!</p>
          <Link to="/notes/new" className="cta-button">
            Create Your First Note
          </Link>
        </div>
      ) : (
        <div className="notes-grid">
          {filteredNotes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onClick={() => navigate(`/notes/${note.id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesList;