'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '../../firebase'; // Corrected path
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link

// --- Type Definitions ---
// Make sure this matches the definition in your profile page
type UserProfile = {
  id: string;
  name: string;
  saeId: string | null;
  // Add other fields if needed by check-in/out logic (e.g., name)
  permissionRole: 'student' | 'admin' | 'super-admin'; // Example, add if needed
  isCheckedIn: boolean; // Assuming this is managed on the user doc now
};

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null); // Store profile data
  const [isCheckedIn, setIsCheckedIn] = useState<boolean | null>(null); // Use null for initial loading state
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- NEW: State for the "Last Person Out" modal ---
  const [showLastPersonModal, setShowLastPersonModal] = useState(false);

  useEffect(() => {
    // Listen for auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user profile to check status and get name
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profileData = { id: userDoc.id, ...userDoc.data() } as UserProfile;
          setUserProfile(profileData);
          setIsCheckedIn(profileData.isCheckedIn); // Set status from profile
        } else {
          console.error("User profile not found!");
          setError("Your profile data is missing. Please contact an admin.");
          // Optionally sign out if profile is critical
          // await auth.signOut();
        }
      } else {
        // Not logged in, redirect to login page
        router.push('/');
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribeAuth();
  }, [router]);

  // --- Handlers ---
  const handleCheckIn = async () => {
    if (!user || !userProfile || isCheckedIn === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const checkInTime = Timestamp.now();
      const attendanceRef = doc(collection(firestore, 'attendance')); // Auto-generate ID

      // Create attendance record
      await setDoc(attendanceRef, {
        userId: user.uid,
        userName: userProfile.name, // Include name
        saeId: userProfile.saeId, // Include SAE ID
        checkInTime: checkInTime,
        checkOutTime: null,
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      });

      // Update lab status
      const labStatusRef = doc(firestore, 'labStatus', 'current');
      await setDoc(labStatusRef, {
          isLabOpen: true,
          currentlyCheckedIn: arrayUnion({ id: user.uid, name: userProfile.name }),
          lastActivityTimestamp: checkInTime, // Track last activity
        }, { merge: true }
      );

      // Update user's profile status
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, { isCheckedIn: true });

      setIsCheckedIn(true);
      alert('Checked in successfully!');
      // Optionally redirect back to profile after check-in
      // router.push('/profile');

    } catch (error) {
      console.error("Error checking in:", error);
      setError(`Failed to check in: ${(error as Error).message}`);
      alert('Failed to check in. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!user || !userProfile || isCheckedIn === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const checkOutTime = Timestamp.now();
      // Find the open attendance record for the user
      const attendanceQuery = query(
        collection(firestore, 'attendance'),
        where('userId', '==', user.uid),
        where('checkOutTime', '==', null) // Find the record without a checkout time
      );
      const querySnapshot = await getDocs(attendanceQuery);

      if (!querySnapshot.empty) {
        // Update attendance record
        const attendanceDocRef = querySnapshot.docs[0].ref;
        await updateDoc(attendanceDocRef, {
          checkOutTime: checkOutTime,
        });

        // Update lab status (remove user)
        const labStatusRef = doc(firestore, 'labStatus', 'current');
        await updateDoc(labStatusRef, {
          currentlyCheckedIn: arrayRemove({ id: user.uid, name: userProfile.name }),
          lastActivityTimestamp: checkOutTime, // Track last activity
        });

        // Update user's profile status
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, { isCheckedIn: false });

        setIsCheckedIn(false);

        // Check if this was the last person AFTER updating the array
        const labStatusDoc = await getDoc(labStatusRef);
        const remainingUsers = labStatusDoc.data()?.currentlyCheckedIn || [];
        if (remainingUsers.length === 0) {
          // --- NEW: Show modal instead of alert ---
          setShowLastPersonModal(true);
          // We will update isLabOpen after modal confirmation
        } else {
          alert('Checked out successfully!');
           // Optionally redirect back to profile after check-out
          // router.push('/profile');
        }
      } else {
        // Handle case where user tries to check out without an open record
        // This might happen if their isCheckedIn state is somehow wrong
        console.warn("No open check-in record found to check out.");
        setError("Could not find an open check-in record. If you believe this is an error, please contact an admin.");
        // Force refresh state from DB?
        setIsCheckedIn(false); // Assume they are out
        await updateDoc(doc(firestore, 'users', user.uid), { isCheckedIn: false });
        alert("No open check-in record found.");
      }
    } catch (error) {
      console.error("Error checking out:", error);
      setError(`Failed to check out: ${(error as Error).message}`);
      alert('Failed to check out. Please try again.');
    }
    setIsSubmitting(false);
  };

  // --- NEW: Function to handle confirming lab closure ---
  const handleConfirmClosure = async () => {
    setIsSubmitting(true); // Reuse submitting state for loading indicator
    try {
      const labStatusRef = doc(firestore, 'labStatus', 'current');
      await updateDoc(labStatusRef, { isLabOpen: false });
      setShowLastPersonModal(false); // Close the modal
      alert('Lab status updated to CLOSED. Thank you!');
       // Optionally redirect back to profile after confirmation
      // router.push('/profile');
    } catch (error) {
        console.error("Error confirming closure:", error);
        alert(`Failed to update lab status: ${(error as Error).message}`);
    }
     setIsSubmitting(false);
  };


  // --- Render Logic ---
  if (loading || isCheckedIn === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Check-in Status...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        {/* Enhanced Check-in Card */}
        <div className="w-full max-w-md animate-fade-in">
          {/* Header Card with Status Badge */}
          <div className="card-solid-bg rounded-t-2xl shadow-elevated p-6 border-b-2 border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Lab Check-in</h2>
                {userProfile && <p className="text-sm text-gray-600 mt-1">Welcome, <span className="font-semibold">{userProfile.name}</span></p>}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isCheckedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {isCheckedIn ? '✓ Checked In' : 'Not In Lab'}
              </div>
            </div>
          </div>

          {/* Main Action Card */}
          <div className="card-solid-bg rounded-b-2xl shadow-elevated p-8">
            {error && (
              <div className="mb-6 p-4 text-sm text-center text-red-800 bg-red-50 rounded-lg border border-red-200 animate-fade-in">
                <svg className="inline-block w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Check In Button */}
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn || isSubmitting}
                className={`w-full group relative overflow-hidden px-6 py-4 font-bold text-white rounded-xl transition-all duration-200 ${
                  isCheckedIn || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-linear-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-soft hover:shadow-elevated hover-lift'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {isSubmitting && !isCheckedIn ? 'Checking In...' : 'Check In'}
                </span>
                {!isCheckedIn && !isSubmitting && (
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                )}
              </button>

              {/* Check Out Button */}
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isSubmitting}
                className={`w-full group relative overflow-hidden px-6 py-4 font-bold text-white rounded-xl transition-all duration-200 ${
                  !isCheckedIn || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-soft hover:shadow-elevated hover-lift'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {isSubmitting && isCheckedIn ? 'Checking Out...' : 'Check Out'}
                </span>
                {isCheckedIn && !isSubmitting && (
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                )}
              </button>
            </div>

            {/* Info Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-start space-x-3 text-sm text-gray-600">
                <svg className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-700 mb-1">Quick Tips:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Check in when you arrive at the lab</li>
                    <li>• Check out when you leave</li>
                    <li>• Last person out will need to secure the lab</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Back Link */}
            <div className="text-center mt-6">
              <Link 
                href="/profile" 
                className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to My Profile
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* --- Enhanced Last Person Out Modal --- */}
      {showLastPersonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-solid-bg rounded-2xl shadow-elevated p-8 w-full max-w-md space-y-5">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Last Person Out!</h2>
              <p className="text-gray-600 mb-4">
                Please ensure the lab is secure before leaving:
              </p>
              <ul className="text-left space-y-2 text-sm text-gray-600 mb-6">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-2 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  All lights and equipment are turned off
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-2 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Windows are closed and secured
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-2 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Lab door is locked properly
                </li>
              </ul>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleConfirmClosure}
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl disabled:bg-gray-400 hover:from-blue-700 hover:to-indigo-700 shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Confirming...
                </span>
              ) : (
                'Yes, Lab is Secured'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

