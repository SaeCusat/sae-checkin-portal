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
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md card-solid-bg p-8 space-y-8 rounded-2xl shadow-elevated animate-fade-in">
            <div className="text-center">
                <div className="inline-block p-3 bg-indigo-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-extrabold gradient-text">Lab Check-in</h2>
                <p className="mt-2 text-sm text-gray-600">Sign in with your Email & Password</p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input 
                          id="email" 
                          name="email" 
                          type="email" 
                          required 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full px-4 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-soft"
                          placeholder="your.email@example.com" 
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input 
                          id="password" 
                          name="password" 
                          type="password" 
                          required 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full px-4 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-soft"
                          placeholder="••••••••" 
                        />
                    </div>
                </div>
                {error && (
                  <div className="p-4 text-sm text-center text-red-800 bg-red-50 rounded-lg border border-red-200 animate-fade-in">
                    <svg className="inline-block w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-end">
                    <div className="text-sm">
                        <button 
                          type="button" 
                          onClick={() => setIsResetModalOpen(true)} 
                          className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            Forgot your password?
                        </button>
                    </div>
                </div>
                <div>
                    <button 
                      type="submit" 
                      className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white bg-linear-to-r from-indigo-600 to-indigo-700 rounded-lg hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift"
                    >
                        Sign in
                    </button>
                </div>
                 <div className="text-center text-sm pt-4 mt-4 border-t border-gray-200">
                    <p className="text-gray-600">New member? <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Register for approval</Link></p>
                </div>
            </form>
        </div>
      </main>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="card-solid-bg rounded-2xl p-8 w-full max-w-md shadow-elevated space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold gradient-text">Reset Your Password</h2>
                      <button 
                        onClick={() => setIsResetModalOpen(false)} 
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        type="button"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                  </div>
                  {resetMessage ? (
                      <div className="text-center space-y-4 py-4">
                          <div className="inline-block p-3 bg-green-100 rounded-full">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-green-700 font-medium">{resetMessage}</p>
                          <button 
                            onClick={() => setIsResetModalOpen(false)} 
                            className="w-full px-4 py-3 bg-linear-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift font-semibold"
                          >
                            Close
                          </button>
                      </div>
                  ) : (
                      <form onSubmit={handlePasswordReset} className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <p className="text-sm text-blue-800">Enter your registered email address to receive a password reset link.</p>
                            </div>
                          </div>
                          <div>
                            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input 
                              id="reset-email"
                              type="email" 
                              value={resetEmail} 
                              onChange={(e) => setResetEmail(e.target.value)} 
                              required 
                              placeholder="your.email@example.com"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-soft transition-all" />
                          </div>
                          {resetError && (
                            <div className="p-3 text-sm text-red-800 bg-red-50 rounded-lg border border-red-200">
                              <svg className="inline-block w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              {resetError}
                            </div>
                          )}
                          <div className="flex justify-end space-x-3 pt-2">
                              <button 
                                type="button" 
                                onClick={() => setIsResetModalOpen(false)} 
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium shadow-soft"
                              >
                                Cancel
                              </button>
                              <button 
                                type="submit" 
                                className="px-5 py-2.5 bg-linear-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift font-semibold"
                              >
                                Send Reset Link
                              </button>
                          </div>
                      </form>
                  )}
              </div>
          </div>
      )}
    </>
  );
}

