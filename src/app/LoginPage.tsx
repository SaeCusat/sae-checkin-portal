// src/app/LoginPage.tsx
'use client';

import { useState } from 'react';
import { auth, firestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation'; // Import the router

export default function LoginPage() {
  const router = useRouter(); // Initialize the router
  const [saeId, setSaeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('saeId', '==', saeId.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('No account found with that SAE ID.');
      }

      const userDoc = querySnapshot.docs[0];
      const userEmail = userDoc.data().email;

      if (!userEmail) {
        throw new Error('User data is incomplete. Email is missing.');
      }

      await signInWithEmailAndPassword(auth, userEmail, password);
      
      // Redirect to the profile page on success
      router.push('/profile'); 

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid SAE ID or password.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">Lab Check-in</h2>
        <p className="mt-2 text-sm text-gray-600">Sign in with your SAE ID</p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleLogin}>
        <div className="space-y-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="sae-id" className="sr-only">SAE ID</label>
            <input
              id="sae-id"
              name="sae-id"
              type="text"
              required
              className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="SAE ID (e.g., SAEME22001)"
              value={saeId}
              onChange={(e) => setSaeId(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 text-sm text-center text-red-800 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end">
          <div className="text-sm">
            <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </a>
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}