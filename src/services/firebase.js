// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Firebase configuration - Note: Using Vite environment variables (VITE_ prefix)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence enabled in first tab only');
  } else if (err.code === 'unimplemented') {
    console.warn('Browser doesn\'t support persistence');
  }
});

// Auth functions
export const registerUser = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with display name
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email: email,
      displayName: displayName || email.split('@')[0],
      createdAt: serverTimestamp(),
      encryptionSalt: null // Will be set when user creates encryption key
    });

    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore functions for notes
export const saveNote = async (note) => {
  try {
    const noteRef = doc(collection(db, 'notes'));
    await setDoc(noteRef, {
      ...note,
      id: noteRef.id,
      createdAt: note.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return noteRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateNote = async (noteId, updates) => {
  try {
    const noteRef = doc(db, 'notes', noteId);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const deleteNote = async (noteId) => {
  try {
    await deleteDoc(doc(db, 'notes', noteId));
  } catch (error) {
    throw error;
  }
};

export const getNotes = async (userId) => {
  try {
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

export const getNote = async (noteId) => {
  try {
    const noteDoc = await getDoc(doc(db, 'notes', noteId));
    if (noteDoc.exists()) {
      return { id: noteDoc.id, ...noteDoc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// User encryption key management
export const saveUserEncryptionSalt = async (userId, salt) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      encryptionSalt: salt,
      encryptionUpdatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const getUserEncryptionSalt = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data().encryptionSalt;
    }
    return null;
  } catch (error) {
    throw error;
  }
};