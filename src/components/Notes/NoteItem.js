import React from 'react';
import './Notes.css';

function NoteItem({ note, onDelete, onClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} days ago`;
    
    return date.toLocaleDateString();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(note.id);
  };

  const truncateContent = (content, maxLength = 100) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substr(0, maxLength) + '...';
  };

  return (
    <div 
      className={`note-card ${note.decryptionError ? 'decryption-error' : ''}`}
      onClick={onClick}
    >
      <div className="note-card-header">
        <h3 className="note-title">
          {note.title || 'Untitled Note'}
        </h3>
        <button 
          className="delete-note-btn"
          onClick={handleDelete}
          title="Delete note"
        >
          🗑️
        </button>
      </div>
      
      <p className="note-content-preview">
        {truncateContent(note.content) || 'No content'}
      </p>
      
      {note.tags && note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.map((tag, index) => (
            <span key={index} className="note-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="note-meta">
        <span>{formatDate(note.updatedAt || note.createdAt)}</span>
        {note.syncStatus === 'pending' && (
          <span className="sync-pending">⏳ Pending sync</span>
        )}
      </div>
    </div>
  );
}

export default NoteItem;