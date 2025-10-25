'use client';

import { useState, FormEvent } from 'react';
import { auth, firestore } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
// CORRECTED: Added doc and getDoc to the imports
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // State for the password reset modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // This logic now works correctly because doc and getDoc are imported
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists() || userDoc.data().accountStatus !== 'approved') {
        await auth.signOut(); // Ensure user is logged out if not approved
        throw new Error('Your account has not been approved yet or does not exist.');
      }
      
      router.push('/profile');
    } catch (err) {
      console.error("Login Error:", err);
      if (err && typeof err === 'object' && 'code' in err) {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
          setError('Invalid email or password.');
        } else if ('message' in err && typeof err.message === 'string') {
          setError(err.message);
        } else {
          setError('An unexpected error occurred.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    try {
        await sendPasswordResetEmail(auth, resetEmail);
        setResetMessage(`A password reset link has been sent to ${resetEmail}. Please check your inbox (and spam folder).`);
    } catch (error) {
        console.error("Password Reset Error:", error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
          setResetError('No account found with that email address.');
        } else {
          setResetError("Failed to send reset email. Please ensure the email address is correct.");
        }
    }
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900">Lab Check-in</h2>
                <p className="mt-2 text-sm text-gray-600">Sign in with your Email & Password</p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-4 rounded-md shadow-sm">
                    <div>
                        <label htmlFor="email" className="sr-only">Email</label>
                        <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Email Address" />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                            className="relative block w-full px-3 py-3 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Password" />
                    </div>
                </div>
                {error && <div className="p-3 text-sm text-center text-red-800 bg-red-100 rounded-md">{error}</div>}
                <div className="flex items-center justify-end">
                    <div className="text-sm">
                        <button type="button" onClick={() => setIsResetModalOpen(true)} className="font-medium text-indigo-600 hover:text-indigo-500">
                            Forgot your password?
                        </button>
                    </div>
                </div>
                <div>
                    <button type="submit" className="relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Sign in
                    </button>
                </div>
                 <div className="text-center text-sm pt-4 mt-4 border-t">
                    <p>New member? <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">Register for approval</Link></p>
                </div>
            </form>
        </div>
      </main>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl space-y-4">
                  <h2 className="text-2xl font-bold mb-4">Reset Your Password</h2>
                  {resetMessage ? (
                      <div className="text-center">
                          <p className="text-green-700">{resetMessage}</p>
                          <button onClick={() => setIsResetModalOpen(false)} className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-md">Close</button>
                      </div>
                  ) : (
                      <form onSubmit={handlePasswordReset}>
                          <p className="text-gray-600 mb-4">Enter your registered email address to receive a password reset link.</p>
                          <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="Email Address"
                              className="w-full px-3 py-3 border border-gray-300 rounded-md" />
                          {resetError && <p className="text-red-600 text-sm mt-2">{resetError}</p>}
                          <div className="flex justify-end space-x-4 pt-4">
                              <button type="button" onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Send Reset Link</button>
                          </div>
                      </form>
                  )}
              </div>
          </div>
      )}
    </>
  );
}

