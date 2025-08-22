// src/app/landing/page.tsx
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
  onSnapshot,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type UserProfile = {
  name: string;
  saeId: string;
  isCheckedIn?: boolean;
};

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUserProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        router.push('/');
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleCheckIn = async () => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, { isCheckedIn: true });

      const attendanceRef = doc(collection(firestore, 'attendance'));
      await setDoc(attendanceRef, {
        userId: user.uid,
        userName: userProfile.name,
        saeId: userProfile.saeId,
        checkInTime: Timestamp.now(),
        checkOutTime: null,
        date: new Date().toISOString().split('T')[0],
      });

      const labStatusRef = doc(firestore, 'labStatus', 'current');
      await setDoc(labStatusRef, {
          isLabOpen: true,
          currentlyCheckedIn: arrayUnion({ id: user.uid, name: userProfile.name }),
        }, { merge: true }
      );
      alert('Checked in successfully!');
    } catch (error) {
      console.error("Error checking in:", error);
      alert('Failed to check in.');
    }
    setIsSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!user || !userProfile) return;
    setIsSubmitting(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const attendanceQuery = query(
        collection(firestore, 'attendance'),
        where('userId', '==', user.uid),
        where('checkOutTime', '==', null)
      );
      const querySnapshot = await getDocs(attendanceQuery);

      if (!querySnapshot.empty) {
        const attendanceDocRef = querySnapshot.docs[0].ref;
        await updateDoc(attendanceDocRef, { checkOutTime: Timestamp.now() });
        await updateDoc(userDocRef, { isCheckedIn: false });

        const labStatusRef = doc(firestore, 'labStatus', 'current');
        const labStatusDoc = await getDoc(labStatusRef);
        await updateDoc(labStatusRef, {
          currentlyCheckedIn: arrayRemove({ id: user.uid, name: userProfile.name }),
        });
        
        const remainingUsers = labStatusDoc.data()?.currentlyCheckedIn || [];
        if (remainingUsers.length === 1) { // If it was 1 before removing, it's now 0
          await updateDoc(labStatusRef, { isLabOpen: false });
          alert('You are the last person out! Please ensure the lab is locked.');
        } else {
          alert('Checked out successfully!');
        }
      } else {
        await updateDoc(userDocRef, { isCheckedIn: false });
        throw new Error("Could not find an open check-in record.");
      }
    } catch (error) {
      console.error("Error checking out:", error);
      alert('Failed to check out.');
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return <p className="text-center mt-10">Loading Check-in...</p>;
  }

  if (user && userProfile) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-sm text-center">
          <div className="p-8 bg-white rounded-lg shadow-md space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Lab Attendance</h1>
            <div>
              <p className="text-lg">Welcome, <span className="font-semibold">{userProfile.name}</span>!</p>
              <p className="text-gray-500">Your current status is: <span className={`font-bold ${userProfile.isCheckedIn ? 'text-green-600' : 'text-red-600'}`}>{userProfile.isCheckedIn ? 'Checked In' : 'Checked Out'}</span></p>
            </div>
            <div className="flex flex-col space-y-4">
              <button
                onClick={handleCheckIn}
                disabled={userProfile.isCheckedIn || isSubmitting}
                className="w-full px-4 py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Confirm Check In
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!userProfile.isCheckedIn || isSubmitting}
                className="w-full px-4 py-3 font-bold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Confirm Check Out
              </button>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full mt-4 px-4 py-2 font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Go to My Profile
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
