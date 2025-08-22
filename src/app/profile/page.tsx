// src/app/profile/page.tsx
'use client';

import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// --- Type Definitions ---
type UserProfile = {
  saeId: string;
  permissionRole: string;
  displayTitle: string;
  name: string;
  branch: string;
  club: string;
  semester: string;
  bloodGroup: string;
  email: string;
  mobileNumber: string;
  guardianNumber: string;
  photoUrl: string;
  isCheckedIn?: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- State for Edit Profile Modal ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    guardianNumber: '',
    bloodGroup: '',
    photoUrl: '',
  });

  // --- Main useEffect Hook ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const profileData = doc.data() as UserProfile;
            setUserProfile(profileData);
            setFormData({
              name: profileData.name,
              mobileNumber: profileData.mobileNumber,
              guardianNumber: profileData.guardianNumber,
              bloodGroup: profileData.bloodGroup,
              photoUrl: profileData.photoUrl,
            });
          } else {
            console.error("No profile data found for this user.");
            signOut(auth);
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
  
  // --- Edit Profile Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    
    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, {
            name: formData.name,
            mobileNumber: formData.mobileNumber,
            guardianNumber: formData.guardianNumber,
            bloodGroup: formData.bloodGroup,
            photoUrl: formData.photoUrl,
        });
        
        alert("Profile updated successfully!");
        setIsModalOpen(false);
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile.");
    }
    setIsSubmitting(false);
  };

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-center">Loading...</p>
      </div>
    );
  }

  if (user && userProfile) {
    return (
      <>
        <main className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="w-full max-w-lg space-y-6">
            {/* Virtual ID Card */}
            <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 p-6 text-white shadow-lg">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold">{userProfile.club}</h2>
                <div className="text-right">
                  <span className="font-semibold">{(userProfile.displayTitle || '').toUpperCase()}</span>
                  <div className={`mt-1 flex items-center justify-end space-x-2 text-xs font-medium px-2 py-1 rounded-full ${userProfile.isCheckedIn ? 'bg-green-400' : 'bg-red-400'}`}>
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                    <span>{userProfile.isCheckedIn ? 'IN LAB' : 'NOT IN LAB'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 my-6">
                <div className="relative">
                  <Image
                    src={userProfile.photoUrl || 'https://i.pravatar.cc/150'}
                    alt="Profile Photo"
                    width={80}
                    height={80}
                    className="rounded-full ring-4 ring-white object-cover"
                    onError={(e) => { e.currentTarget.src = 'https://i.pravatar.cc/150'; }}
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
                <p><strong>Blood Group:</strong> {userProfile.bloodGroup}</p>
                <p><strong>Mobile:</strong> {userProfile.mobileNumber}</p>
                <p><strong>Guardian:</strong> {userProfile.guardianNumber}</p>
                <p><strong>Email:</strong> {userProfile.email}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-white rounded-lg shadow-md space-y-4">
              {/* --- CONDITIONAL ADMIN BUTTON --- */}
              {(userProfile.permissionRole === 'admin' || userProfile.permissionRole === 'super-admin') && (
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full px-4 py-3 font-bold text-white bg-purple-600 rounded-md hover:bg-purple-700"
                >
                  Go to Admin Dashboard
                </button>
              )}
              <div className="flex space-x-4">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => signOut(auth)}
                  className="w-full px-4 py-3 font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Edit Profile Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6">Edit Your Profile</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label htmlFor="photoUrl" className="block text-sm font-medium text-gray-700">Photo URL</label>
                  <input type="url" name="photoUrl" id="photoUrl" value={formData.photoUrl} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="https://example.com/photo.jpg" required />
                </div>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                  <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700">Mobile Number</label>
                  <input type="tel" name="mobileNumber" id="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                  <label htmlFor="guardianNumber" className="block text-sm font-medium text-gray-700">Guardian's Number</label>
                  <input type="tel" name="guardianNumber" id="guardianNumber" value={formData.guardianNumber} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                  <label htmlFor="bloodGroup" className="block text-sm font-medium text-gray-700">Blood Group</label>
                  <input type="text" name="bloodGroup" id="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
