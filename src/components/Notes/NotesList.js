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
    loadNotes();
  }, [user, isOffline]);

  const loadNotes = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      let encryptedNotes = [];
      
      if (isOffline) {
        // Load from IndexedDB when offline
        encryptedNotes = await notesDB.getLocalNotes(user.uid);
      } else {
        // Load from Firebase when online - FIXED: Added userId parameter
        encryptedNotes = await getNotes(user.uid);
        
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

      setNotes(decryptedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
      setError('Failed to load notes. Please try again.');
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
        // FIXED: Added userId parameter
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
        <div className="loading">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="notes-container">
      <div className="notes-header">
        <h1>My Notes</h1>
        <Link to="/notes/new" className="new-note-btn">
          + New Note
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredNotes.length === 0 ? (
        <div className="empty-state">
          <p>No notes yet. Create your first note!</p>
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