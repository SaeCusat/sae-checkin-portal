'use client';

import { useState, FormEvent } from 'react';
import { auth, firestore } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
// CORRECTED: Added doc and getDoc to the imports
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // State for the password reset modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('loading'); // Set loading state

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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {/* 
          RESPONSIVE CONTAINER
          - Mobile (320px+): Full width with padding
          - Tablet (768px+): Max width with more padding
          - Desktop (1024px+): Fixed max width
        */}
        <div className="w-full max-w-md card-solid-bg rounded-2xl sm:rounded-3xl shadow-2xl animate-fade-in overflow-hidden">
          {/* Header with gradient background */}
          <div className="px-6 sm:px-10 pt-6 sm:pt-8 pb-6 sm:pb-8 bg-linear-to-r from-indigo-700 to-blue-900">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Sign In</h2>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1 text-center">Access your lab check-in portal</p>
          </div>

          {/* Form Section with responsive padding */}
          <div className="px-6 sm:px-10 py-6 sm:py-8">
            <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <input 
                          id="email" 
                          name="email" 
                          type="email" 
                          required 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full px-4 py-3 text-gray-900 placeholder-gray-400 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          placeholder="email@example.com"
                          aria-label="Email Address"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                          <label htmlFor="password" className="block text-sm font-semibold text-gray-700">Password</label>
                          <button 
                            type="button" 
                            onClick={() => setIsResetModalOpen(true)} 
                            className="text-xs font-medium text-indigo-700 hover:text-indigo-800 transition-colors underline"
                            aria-label="Forgot Password"
                          >
                              Forgot Password?
                          </button>
                        </div>
                        <div className="relative">
                          <input 
                            id="password" 
                            name="password" 
                            type={showPassword ? "text" : "password"}
                            required 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="••••••••"
                            aria-label="Password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                    </div>
                </div>
                
                {error && (
                  <div className="p-4 text-sm text-red-800 bg-red-50 rounded-lg border-l-4 border-red-600 animate-fade-in" role="alert">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 mr-2 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {/* Loading state for form submission */}
                <button 
                  type="submit" 
                  disabled={!!error && error.includes('loading')}
                  className="w-full px-6 py-3.5 text-sm sm:text-base font-bold text-white bg-linear-to-r from-indigo-700 to-blue-900 rounded-lg hover:from-indigo-800 hover:to-blue-950 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-11"
                  aria-label="Sign in to your account"
                >
                    {error && error.includes('loading') ? (
                      <span className="flex items-center justify-center">
                        <span className="spinner mr-2"></span>
                        Signing in...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                </button>

                <div className="text-center pt-2">
                    <p className="text-sm text-gray-600">
                      Don&apos;t have an account?{' '}
                      <Link href="/signup" className="font-semibold text-indigo-700 hover:text-indigo-800 transition-colors underline">
                        Register
                      </Link>
                    </p>
                </div>
            </form>
          </div>
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

