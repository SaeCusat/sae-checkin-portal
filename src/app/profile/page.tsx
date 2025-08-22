// src/app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
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
import Image from 'next/image';

// --- Type Definitions ---
type UserProfile = {
  saeId: string;
  role: string;
  name: string;
  branch: string;
  club: string;
  semester: string;
  bloodGroup: string;
  email: string;
  mobileNumber: string;
  guardianNumber: string;
  photoUrl: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Main useEffect Hook ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // --- DIAGNOSTIC LOG ---
        console.log("Auth State Changed. Logged-in User UID:", currentUser.uid);
        
        setUser(currentUser);
        // Fetch profile first, THEN check status. This is the fix.
        const profile = await fetchUserProfile(currentUser);
        if (profile) {
          await checkUserStatus(currentUser.uid);
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // --- Data Fetching Functions ---
  const fetchUserProfile = async (currentUser: User) => {
    try {
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setUserProfile(profileData);
        return profileData; // Return data on success
      } else {
        console.error("Firestore document not found for user:", currentUser.uid);
        return null; // Return null on failure
      }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        // This is where the permission error will be caught
        return null;
    }
  };

  const checkUserStatus = async (uid: string) => {
    try {
        const attendanceQuery = query(
          collection(firestore, 'attendance'),
          where('userId', '==', uid),
          where('checkOutTime', '==', null)
        );
        const querySnapshot = await getDocs(attendanceQuery);
        setIsCheckedIn(!querySnapshot.empty);
    } catch (error) {
        console.error("Error checking user status:", error);
    }
  };

  // --- Check-in/Check-out Handlers ---
  const handleCheckIn = async () => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const checkInTime = Timestamp.now();
      const attendanceRef = doc(collection(firestore, 'attendance'));
      
      await setDoc(attendanceRef, {
        userId: user.uid,
        userName: userProfile.name,
        saeId: userProfile.saeId,
        checkInTime: checkInTime,
        checkOutTime: null,
        date: new Date().toISOString().split('T')[0],
      });

      const labStatusRef = doc(firestore, 'labStatus', 'current');
      await setDoc(labStatusRef, {
          isLabOpen: true,
          currentlyCheckedIn: arrayUnion({ id: user.uid, name: userProfile.name }),
        }, { merge: true }
      );

      setIsCheckedIn(true);
      alert('Checked in successfully!');
    } catch (error) {
      console.error("Error checking in:", error);
      alert('Failed to check in. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const attendanceQuery = query(
        collection(firestore, 'attendance'),
        where('userId', '==', user.uid),
        where('checkOutTime', '==', null)
      );
      const querySnapshot = await getDocs(attendanceQuery);

      if (!querySnapshot.empty) {
        const attendanceDocRef = querySnapshot.docs[0].ref;
        await updateDoc(attendanceDocRef, {
          checkOutTime: Timestamp.now(),
        });

        const labStatusRef = doc(firestore, 'labStatus', 'current');
        await updateDoc(labStatusRef, {
          currentlyCheckedIn: arrayRemove({ id: user.uid, name: userProfile.name }),
        });
        
        const labStatusDoc = await getDoc(labStatusRef);
        const remainingUsers = labStatusDoc.data()?.currentlyCheckedIn || [];
        if (remainingUsers.length === 0) {
          await updateDoc(labStatusRef, { isLabOpen: false });
          alert('You are the last person out! Please ensure the lab is locked.');
        } else {
          alert('Checked out successfully!');
        }
        setIsCheckedIn(false);

      } else {
        throw new Error("Could not find an open check-in record.");
      }
    } catch (error) {
      console.error("Error checking out:", error);
      alert('Failed to check out. Please try again.');
    }
    setIsSubmitting(false);
  };

  // --- Render Logic ---
  if (loading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (user && userProfile) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Virtual ID Card */}
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 p-6 text-white shadow-lg">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold">{userProfile.club}</h2>
              <span className="font-semibold">{userProfile.role.toUpperCase()}</span>
            </div>
            <div className="flex items-center space-x-4 my-6">
              <div className="relative">
                <Image
                  src={userProfile.photoUrl}
                  alt="Profile Photo"
                  width={80}
                  height={80}
                  className="rounded-full ring-4 ring-white"
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{userProfile.name}</h3>
                <p className="text-sm opacity-90">{userProfile.saeId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><strong>Branch:</strong> {userProfile.branch}</p>
              <p><strong>Semester:</strong> {userProfile.semester}</p>
              <p><strong>Email:</strong> {userProfile.email}</p>
              <p><strong>Mobile:</strong> {userProfile.mobileNumber}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 bg-white rounded-lg shadow-md space-y-4">
            <h3 className="text-xl font-bold text-center">Lab Attendance</h3>
            <div className="flex space-x-4">
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn || isSubmitting}
                className="w-full px-4 py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Check In
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isSubmitting}
                className="w-full px-4 py-3 font-bold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Check Out
              </button>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="w-full mt-4 px-4 py-2 font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
