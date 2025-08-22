// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type UserProfile = {
  role: string;
  name: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is logged in, now check their role
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userProfile = userDoc.data() as UserProfile;
          // IMPORTANT: Check if the user is an admin or super-admin
          if (userProfile.role === 'admin' || userProfile.role === 'super-admin') {
            setUser(currentUser);
          } else {
            // Not an admin, redirect to their profile
            alert("Access Denied. You are not an admin.");
            router.push('/profile');
          }
        } else {
          // No user document found, redirect to login
          router.push('/');
        }
      } else {
        // Not logged in, redirect to login
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <p className="text-center mt-10">Loading Admin Dashboard...</p>;
  }

  if (user) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800">Admin Dashboard</h1>
            <button
              onClick={() => auth.signOut()}
              className="px-4 py-2 font-bold text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
          {/* We will add the dashboard components here in the next step */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold">Welcome, Admin!</h2>
            <p className="mt-2 text-gray-600">More features coming soon.</p>
          </div>
        </div>
      </main>
    );
  }

  return null; // Render nothing while redirecting
}
