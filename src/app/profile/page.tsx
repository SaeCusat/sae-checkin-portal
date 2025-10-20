'use client';

import { useEffect, useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// --- Type Definitions ---
type UserProfile = {
  id: string;
  name: string;
  saeId: string | null;
  email: string;
  branch: string;
  joinYear: string;
  semester: string;
  bloodGroup: string;
  mobileNumber: string;
  guardianNumber: string;
  photoUrl: string;
  permissionRole: 'student' | 'admin' | 'super-admin';
  displayTitle: string;
  accountStatus: 'pending' | 'approved' | 'rejected';
  isCheckedIn: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    guardianNumber: '',
    bloodGroup: '',
    photoUrl: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user?.uid) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data() as Omit<UserProfile, 'id'>;
          setUserProfile({ id: doc.id, ...data });
          setFormData({
            name: data.name || '',
            mobileNumber: data.mobileNumber || '',
            guardianNumber: data.guardianNumber || '',
            bloodGroup: data.bloodGroup || '',
            photoUrl: data.photoUrl || '',
          });
        } else {
          console.error("No profile data found for this user.");
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, formData);
      alert('Profile updated successfully!');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  if (loading || !userProfile) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading Profile...</p></div>;
  }
  
  const isAdmin = userProfile.permissionRole === 'admin' || userProfile.permissionRole === 'super-admin';

  // Helper component for perfectly aligned details
  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex">
      <span className="w-28 font-semibold opacity-70 flex-shrink-0 flex justify-between pr-2">
        <span>{label}</span>
        <span>:</span>
      </span>
      <span className="truncate">{value}</span>
    </div>
  );

  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="w-full max-w-md mx-auto">
          {/* Redesigned Virtual ID Card */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 p-6 text-white shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <Image
                src="/logo/sae_logo_white.png" 
                alt="SAE CUSAT Logo"
                width={70} 
                height={35} 
                priority
              />
              <div className="text-right">
                <span className="font-bold tracking-wider">{userProfile.displayTitle ? userProfile.displayTitle.toUpperCase() : userProfile.permissionRole.toUpperCase()}</span>
                <div className={`mt-1 flex items-center justify-end space-x-2 text-xs font-medium px-2 py-0.5 rounded-full ${userProfile.isCheckedIn ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                  <div className={`w-2 h-2 rounded-full ${userProfile.isCheckedIn ? 'bg-green-900' : 'bg-red-900'}`}></div>
                  <span>{userProfile.isCheckedIn ? 'IN LAB' : 'NOT IN LAB'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-5">
              <Image
                src={userProfile.photoUrl || `https://i.pravatar.cc/150?u=${userProfile.id}`}
                alt="Profile Photo"
                width={88}
                height={88}
                className="rounded-full ring-4 ring-white/20 object-cover"
                priority
              />
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{userProfile.name}</h3>
                <p className="text-sm font-mono opacity-80">{userProfile.saeId || 'Pending ID'}</p>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4 space-y-2 text-sm">
              <DetailRow label="Branch" value={userProfile.branch} />
              <DetailRow label="Semester" value={userProfile.semester} />
              <DetailRow label="Email" value={userProfile.email} />
              <DetailRow label="Mobile" value={userProfile.mobileNumber} />
              <DetailRow label="Blood Group" value={userProfile.bloodGroup} />
              <DetailRow label="Guardian" value={userProfile.guardianNumber} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-md space-y-3">
             {isAdmin && (
                <Link href="/admin" className="w-full text-center block px-4 py-3 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg hover:opacity-90 transition-opacity">
                  Admin Dashboard
                </Link>
             )}
             <button onClick={() => setIsEditModalOpen(true)} className="w-full px-4 py-2 font-bold text-gray-800 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                Edit Profile
             </button>
             <button onClick={() => auth.signOut()} className="w-full px-4 py-2 font-bold text-gray-800 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                Sign Out
             </button>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl space-y-4">
            <h2 className="text-2xl font-bold mb-4">Edit Your Profile</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
              <input type="text" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Guardian's Number</label>
              <input type="text" value={formData.guardianNumber} onChange={(e) => setFormData({ ...formData, guardianNumber: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Blood Group</label>
              <input type="text" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Photo URL</label>
              <input type="text" value={formData.photoUrl} onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
            </div>
            <div className="flex justify-end space-x-4 pt-4">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

