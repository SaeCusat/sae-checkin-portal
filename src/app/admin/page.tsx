// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

// --- Type Definitions ---
type UserProfile = {
  role: string;
  name: string;
};

type CheckedInUser = {
  id: string;
  name: string;
};

type LabStatus = {
  isLabOpen: boolean;
  currentlyCheckedIn: CheckedInUser[];
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [labStatus, setLabStatus] = useState<LabStatus>({ isLabOpen: false, currentlyCheckedIn: [] });
  const [loading, setLoading] = useState(true);

  // --- Main Authentication useEffect ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userProfile = userDoc.data() as UserProfile;
          if (userProfile.role === 'admin' || userProfile.role === 'super-admin') {
            setUser(currentUser);
          } else {
            alert("Access Denied. You are not an admin.");
            router.push('/profile');
          }
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // --- Real-time Lab Status useEffect ---
  useEffect(() => {
    // This effect runs only when a user is confirmed to be an admin
    if (user) {
      const labStatusRef = doc(firestore, 'labStatus', 'current');
      
      // onSnapshot creates a real-time listener
      const unsubscribeStatus = onSnapshot(labStatusRef, (doc) => {
        if (doc.exists()) {
          setLabStatus(doc.data() as LabStatus);
        } else {
          // If the document doesn't exist, set a default state
          setLabStatus({ isLabOpen: false, currentlyCheckedIn: [] });
        }
      });

      // Cleanup the listener when the component unmounts
      return () => unsubscribeStatus();
    }
  }, [user]); // Dependency array ensures this runs when the user state is set

  if (loading) {
    return <p className="text-center mt-10">Loading Admin Dashboard...</p>;
  }

  if (user) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">Admin Dashboard</h1>
            <button
              onClick={() => auth.signOut()}
              className="mt-4 sm:mt-0 px-4 py-2 font-bold text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
          
          {/* Grid for Dashboard Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Status Card */}
            <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700">Live Status</h2>
              <div className="mt-4 flex items-center">
                <span className={`w-4 h-4 rounded-full mr-3 ${labStatus.isLabOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-lg font-medium">{labStatus.isLabOpen ? 'Lab is Open' : 'Lab is Closed'}</span>
              </div>
              <div className="mt-4">
                <p className="text-5xl font-bold text-gray-800">{labStatus.currentlyCheckedIn.length}</p>
                <p className="text-gray-500">Members currently in lab</p>
              </div>
            </div>

            {/* Currently In Lab Card */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700">Currently In Lab</h2>
              <div className="mt-4">
                {labStatus.currentlyCheckedIn.length > 0 ? (
                  <ul className="space-y-3">
                    {labStatus.currentlyCheckedIn.map((member) => (
                      <li key={member.id} className="p-3 bg-gray-50 rounded-md text-gray-700">
                        {member.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No one is currently checked in.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
