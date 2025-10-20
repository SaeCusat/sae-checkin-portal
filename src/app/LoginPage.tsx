'use client';

import { useState, FormEvent } from 'react';
import { auth, firestore } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Approval Check
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // This case is unlikely if sign-up is the only entry point, but it's good for safety
        await auth.signOut();
        throw new Error("User data not found. Please contact an admin.");
      }
      
      const userData = userDoc.data();
      if (userData.accountStatus !== 'approved') {
        // Log the user out immediately to prevent access
        await auth.signOut();
        if (userData.accountStatus === 'pending') {
          throw new Error('Your account is awaiting admin approval. Please check back later.');
        } else {
          throw new Error('Your account has been rejected or is inactive.');
        }
      }

      // If approved, proceed to profile
      router.push('/profile');

    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');
    setIsSubmittingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Success! A password reset link has been sent to your email address.');
    } catch (err: any) {
      console.error("Password Reset Error:", err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with that email address.');
      } else {
        setResetError(err.message || 'Failed to send reset email.');
      }
    }
    setIsSubmittingReset(false);
  };

  return (
    <>
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Lab Check-in</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in with your Email</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input id="email-address" name="email" type="email" autoComplete="email" required
                className="input-style" placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required
                className="input-style" placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="p-3 text-sm text-center text-red-800 bg-red-100 rounded-md">{error}</p>}

          <div className="flex items-center justify-end text-sm">
            <button type="button" onClick={() => setIsResetModalOpen(true)} className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </button>
          </div>
          <div>
            <button type="submit" className="button-primary w-full">Sign in</button>
          </div>
        </form>
        <div className="text-sm text-center pt-4 border-t">
          <p className="text-gray-600">
            New Member?{' '}
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              Register Here
            </Link>
          </p>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
            <p className="mb-6 text-sm text-gray-600">Enter your email address below. We will send a password reset link to you.</p>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="sr-only">Email</label>
                <input type="email" name="reset-email" id="reset-email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Email Address" required />
              </div>
              
              {resetMessage && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{resetMessage}</p>}
              {resetError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{resetError}</p>}
              
              <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300">Cancel</button>
                <button type="submit" disabled={isSubmittingReset} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md disabled:bg-gray-400 hover:bg-indigo-700">
                  {isSubmittingReset ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style jsx global>{`
        .input-style {
          position: relative; box-sizing: border-box; height: auto; padding: 12px; font-size: 16px; width: 100%;
          border: 1px solid #D1D5DB; border-radius: 0.375rem; appearance: none;
        }
        .input-style:focus {
          outline: 2px solid transparent; outline-offset: 2px; border-color: #4F46E5; box-shadow: 0 0 0 2px #4F46E5;
        }
        .button-primary {
          position: relative; display: flex; justify-content: center; width: 100%;
          padding: 12px 16px; font-size: 14px; font-weight: 500; color: white;
          background-color: #4F46E5; border: 1px solid transparent; border-radius: 0.375rem;
        }
        .button-primary:hover {
          background-color: #4338CA;
        }
      `}</style>
    </>
  );
}

