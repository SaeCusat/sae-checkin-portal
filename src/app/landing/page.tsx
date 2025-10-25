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

    } catch (error: any) {
      console.error("Error checking in:", error);
      setError(`Failed to check in: ${error.message}`);
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
    } catch (error: any) {
      console.error("Error checking out:", error);
      setError(`Failed to check out: ${error.message}`);
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
    } catch (error: any) {
        console.error("Error confirming closure:", error);
        alert(`Failed to update lab status: ${error.message}`);
    }
     setIsSubmitting(false);
  };


  // --- Render Logic ---
  if (loading || isCheckedIn === null) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading Check-in Status...</p></div>;
  }

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Lab Check-in/Out</h2>
            {userProfile && <p className="mt-1 text-gray-600">Welcome, {userProfile.name}</p>}
          </div>

          {error && <p className="p-3 text-sm text-center text-red-800 bg-red-100 rounded-md">{error}</p>}

          <div className="flex flex-col space-y-4">
            <button
              onClick={handleCheckIn}
              disabled={isCheckedIn || isSubmitting}
              className="px-4 py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Check In
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!isCheckedIn || isSubmitting}
              className="px-4 py-3 font-bold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Check Out
            </button>
          </div>

          <div className="text-center mt-4">
            <Link href="/profile" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
               Go Back to My Profile
            </Link>
          </div>
        </div>
      </main>

      {/* --- NEW: Last Person Out Modal --- */}
      {showLastPersonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl space-y-4 text-center">
             <h2 className="text-xl font-bold text-orange-600 mb-4">You are the Last Person Out!</h2>
             <p className="text-gray-700">
                Please double-check that all lights and equipment are turned off, windows are closed, and the lab door is securely locked.
             </p>
             <p className="font-semibold">Confirm lab is secured?</p>
             <div className="flex justify-center space-x-4 pt-4">
                {/* Optional: Add a cancel button if needed */}
                {/* <button type="button" onClick={() => setShowLastPersonModal(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button> */}
                <button
                  type="button"
                  onClick={handleConfirmClosure}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md disabled:bg-gray-400 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Confirming...' : 'Yes, Lab Secured'}
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}

