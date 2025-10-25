'use client';

import { useEffect, useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  // Removed limit as we filter by date now
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// --- Type and Constant Definitions ---
const TEAM_OPTIONS = [
  "TARUSA", "YETI", "ASTRON ENDURANCE", "MARUTSAKHA",
  "HERMES", "ELEKTRA", "STORM RACING", "BEHEMOTH", "AROHA"
];

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
  team: string;
};

type AttendanceRecord = {
  id: string;
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
  date: string;
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
    team: '',
  });

  // --- Attendance History State ---
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  // --- NEW: State for the date filter ---
  const [historyFilterDate, setHistoryFilterDate] = useState(new Date().toISOString().split('T')[0]); // Default to today

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/');
      }
      // Keep loading true until profile is fetched
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Fetch Profile Data
  useEffect(() => {
    if (user?.uid) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data() as Omit<UserProfile, 'id'>;
          setUserProfile({ id: doc.id, ...data });
          setFormData({
            name: data.name || '',
            mobileNumber: data.mobileNumber || '',
            guardianNumber: data.guardianNumber || '',
            bloodGroup: data.bloodGroup || '',
            photoUrl: data.photoUrl || '',
            team: data.team || TEAM_OPTIONS[0],
          });
          setLoading(false); // Stop loading once profile is fetched
        } else {
          console.error("No profile data found for this user.");
          auth.signOut(); // Log out if profile is missing
        }
      }, (error) => {
          console.error("Error fetching profile:", error);
          setLoading(false); // Stop loading on error
      });
      return () => unsubscribeProfile();
    } else {
        setLoading(false); // If no user, stop loading
    }
  }, [user]);

  // Fetch Attendance History based on the selected date
  useEffect(() => {
    if (user?.uid) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          // --- UPDATED QUERY: Filter by date ---
          const attendanceQuery = query(
            collection(firestore, 'attendance'),
            where('userId', '==', user.uid),
            where('date', '==', historyFilterDate), // Filter by the selected date
            orderBy('checkInTime', 'asc') // Show earliest first for the day
          );
          const querySnapshot = await getDocs(attendanceQuery);
          const historyData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
          setAttendanceHistory(historyData);
        } catch (error) {
          console.error("Error fetching attendance history:", error);
          alert("Could not load your attendance history."); // User feedback
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [user, historyFilterDate]); // --- Re-fetch when the date changes ---

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      // Helper function for URL conversion
      const convertGoogleDriveUrl = (url: string): string => {
        if (!url || !url.includes('drive.google.com')) return url;
        const match = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
        if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
        return url;
      };

      const correctedFormData = {
        ...formData,
        photoUrl: convertGoogleDriveUrl(formData.photoUrl),
      };

      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, correctedFormData);
      alert('Profile updated successfully!');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  // Helper function for formatting dates/times
  const formatTimestamp = (timestamp: Timestamp | null, type: 'time' | 'date' = 'time') => {
    if (!timestamp) return 'In Lab';
    const date = timestamp.toDate();
    if (type === 'time') {
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };

  if (loading) {
     return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg font-semibold">Loading Profile...</p>
      </div>
    );
  }

  if (!userProfile) {
     return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-lg font-semibold text-red-600">Could not load profile data.</p>
        <button onClick={() => auth.signOut()} className="ml-4 px-4 py-2 bg-gray-200 rounded-md">Sign Out</button>
      </div>
    );
  }

  const isAdmin = userProfile.permissionRole === 'admin' || userProfile.permissionRole === 'super-admin';

  // Helper component for perfectly aligned details
  const DetailRow = ({ label, value }: { label: string; value: string | undefined | null }) => (
    <div className="flex">
      <span className="w-28 font-semibold opacity-70 flex-shrink-0 flex justify-between pr-2">
        <span>{label}</span>
        <span>:</span>
      </span>
      <span className="truncate">{value || 'N/A'}</span>
    </div>
  );

  return (
    <>
      <main className="flex flex-col items-center min-h-screen bg-gray-100 p-4 pt-10 pb-10">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Virtual ID Card */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white shadow-2xl">
             <div className="p-6">
              <div className="flex justify-between items-center">
                 <Image
                  src="/logo/sae_logo_white.png"
                  alt="SAE CUSAT Logo"
                  width={70}
                  height={35}
                  priority
                  onError={(e) => { e.currentTarget.src = 'https://placehold.co/70x35/cccccc/ffffff?text=Logo'; }}
                />
                <div className="text-right">
                  <span className="font-bold tracking-wider">{userProfile.displayTitle ? userProfile.displayTitle.toUpperCase() : userProfile.permissionRole.toUpperCase()}</span>
                   <div className={`mt-1 flex items-center justify-end space-x-2 text-xs font-medium px-2 py-0.5 rounded-full ${userProfile.isCheckedIn ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                    <div className={`w-2 h-2 rounded-full ${userProfile.isCheckedIn ? 'bg-green-900' : 'bg-red-900'}`}></div>
                    <span>{userProfile.isCheckedIn ? 'IN LAB' : 'NOT IN LAB'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-5 mt-6">
                 <Image
                  src={userProfile.photoUrl || `https://placehold.co/88x88/cccccc/ffffff?text=${userProfile.name?.[0] || '?'}`}
                  alt="Profile Photo"
                  width={88}
                  height={88}
                  className="rounded-full ring-4 ring-white/20 object-cover bg-gray-300"
                  priority
                   onError={(e) => { e.currentTarget.src = `https://placehold.co/88x88/cccccc/ffffff?text=${userProfile.name?.[0] || '?'}`; }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-bold truncate">{userProfile.name}</h3>
                  <p className="text-sm font-mono opacity-80">{userProfile.saeId || 'Pending ID'}</p>
                </div>
              </div>

              <div className="border-t border-white/20 pt-4 mt-6 space-y-2 text-sm">
                <DetailRow label="Branch" value={userProfile.branch} />
                <DetailRow label="Semester" value={userProfile.semester} />
                <DetailRow label="Email" value={userProfile.email} />
                <DetailRow label="Mobile" value={userProfile.mobileNumber} />
                <DetailRow label="Blood Group" value={userProfile.bloodGroup} />
                <DetailRow label="Guardian" value={userProfile.guardianNumber} />
              </div>
            </div>

            {userProfile.team && (
              <div className="bg-white/10 rounded-b-2xl px-6 py-3 text-center">
                <span className="text-xs font-semibold tracking-widest opacity-70">TEAM</span>
                <p className="text-lg font-bold">{userProfile.team}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-white rounded-lg shadow-md space-y-3">
             {isAdmin && (
                <Link href="/admin" className="w-full text-center block px-4 py-3 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow hover:opacity-90 transition-opacity">
                  Admin Dashboard
                </Link>
             )}
             <button onClick={() => setIsEditModalOpen(true)} className="w-full px-4 py-2 font-bold text-indigo-700 bg-indigo-100 rounded-lg shadow-sm hover:bg-indigo-200 transition-colors">
                Edit Profile
             </button>
             <button onClick={() => auth.signOut()} className="w-full px-4 py-2 font-bold text-gray-700 bg-gray-200 rounded-lg shadow-sm hover:bg-gray-300 transition-colors">
                Sign Out
             </button>
          </div>

          {/* Attendance History Section */}
          <div className="p-6 bg-white rounded-lg shadow-md">
            {/* --- NEW: Date Filter Input --- */}
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-gray-800">My Attendance History</h3>
               <input
                 type="date"
                 value={historyFilterDate}
                 onChange={(e) => setHistoryFilterDate(e.target.value)}
                 className="border rounded-md px-2 py-1 text-sm"
               />
            </div>
            {/* --- End of Date Filter Input --- */}

            {historyLoading ? (
              <p className="text-gray-500">Loading history...</p>
            ) : attendanceHistory.length > 0 ? (
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Check In</th>
                      <th className="p-2">Check Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map(record => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{formatTimestamp(record.checkInTime, 'date')}</td>
                        <td className="p-2">{formatTimestamp(record.checkInTime, 'time')}</td>
                        <td className="p-2">{formatTimestamp(record.checkOutTime, 'time')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No attendance records found for {new Date(historyFilterDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.</p>
            )}
          </div>

        </div>
      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-lg p-6 sm:p-8 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Edit Your Profile</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm"/>
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">Team Name</label>
              <select value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm">
                  {TEAM_OPTIONS.map(team => <option key={team} value={team}>{team}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
              <input type="tel" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Guardian's Number</label>
              <input type="tel" value={formData.guardianNumber} onChange={(e) => setFormData({ ...formData, guardianNumber: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Blood Group</label>
              <input type="text" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Photo URL</label>
              <input type="url" value={formData.photoUrl} onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm"/>
               <p className="mt-1 text-xs text-gray-500">Paste a public link (e.g., from Google Drive, set to 'Anyone with the link').</p>
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

