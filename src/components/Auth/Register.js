// src/components/Auth/Register.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, saveUserEncryptionSalt } from '../../services/firebase';
import encryptionService from '../../services/encryption';
import notesDB from '../../services/indexedDB';
import './Auth.css';

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    encryptionPassword: '',
    displayName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Register user with Firebase
      const user = await registerUser(
        formData.email,
        formData.password,
        formData.displayName
      );

      // Generate encryption key from password
      const encPassword = formData.encryptionPassword || formData.password;
      const { key, salt } = await encryptionService.deriveKeyFromPassword(encPassword);

      // Set the master key for this session
      encryptionService.setMasterKey(key);

      // Save encryption salt to Firestore
      await saveUserEncryptionSalt(user.uid, salt);

      // Save salt locally for offline access
      await notesDB.saveEncryptionSalt(user.uid, salt);

      // Store encryption key in session storage as backup
      sessionStorage.setItem('encKey', key);

      console.log('User registered and encryption key set');

      // Navigate to notes
      navigate('/notes');
    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email is already registered');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(error.message || 'Failed to register. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🔒 Create Secure Account</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <input
              type="text"
              name="displayName"
              placeholder="Display Name (optional)"
              value={formData.displayName}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password (min 8 characters)"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="encryptionPassword"
              placeholder="Encryption Password (optional)"
              value={formData.encryptionPassword}
              onChange={handleChange}
              className="form-input"
            />
            <small className="help-text">
              💡 Use a different password for extra security, or leave empty to use login password
            </small>
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>

        <div className="security-notice">
          <p>🔐 Your notes are encrypted end-to-end</p>
          <p>📝 We never see your decrypted content</p>
          <p>🔑 Remember your encryption password - it cannot be recovered!</p>
        </div>
      </div>
    </div>
  );
}

export default Register;