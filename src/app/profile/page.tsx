'use client';

import { useEffect, useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase'; // Correct path assumed
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
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// --- Type and Constant Definitions ---
const TEAM_OPTIONS = [
  "TARUSA", "YETI", "ASTRON ENDURANCE", "MARUTSAKHA",
  "HERMES", "ELEKTRA", "STORM RACING", "BEHEMOTH", "AROHA"
];
const BRANCH_OPTIONS = ["ME", "EEE", "ECE", "SF", "CS", "IT", "CE"];

// --- NEW: Define Placeholder URLs ---
const STUDENT_PLACEHOLDER_BASE = 'https://placehold.co/88x88/cccccc/444444?text=';
const FACULTY_PLACEHOLDER_URL = 'https://placehold.co/88x88/64748b/ffffff?text=User'; // Neutral gray placeholder


type UserProfile = {
  id: string;
  name: string;
  saeId: string | null;
  email: string;
  userType: 'student' | 'faculty';
  branch?: string; // Also used for faculty department
  joinYear?: string;
  semester?: string;
  team?: string;
  guardianNumber?: string; // Optional
  bloodGroup: string;
  mobileNumber: string;
  photoUrl: string; // Can be empty string
  permissionRole: 'student' | 'admin' | 'super-admin';
  displayTitle: string;
  accountStatus: 'pending' | 'approved' | 'rejected';
  isCheckedIn: boolean;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    guardianNumber: '',
    bloodGroup: '',
    photoUrl: '',
    team: '',
    department: '',
  });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFilterDate, setHistoryFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Authentication Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            router.push('/');
        }
        setLoading(false); setUserProfile(null);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Profile Data Listener
  useEffect(() => {
    if (user?.uid) {
      setLoading(true);
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<UserProfile, 'id'>;
          if (!data.name || !data.email || !data.userType || !data.permissionRole || !data.accountStatus) {
             console.error("Critical profile data missing:", data);
             alert("Error: Critical profile data is missing. Logging out.");
             auth.signOut(); setLoading(false); return;
          }
          setUserProfile({ id: docSnap.id, ...data });
          setFormData({
            name: data.name,
            mobileNumber: data.mobileNumber || '',
            guardianNumber: data.guardianNumber || '',
            bloodGroup: data.bloodGroup || '',
            photoUrl: data.photoUrl || '',
            team: data.userType === 'student' ? (data.team || TEAM_OPTIONS[0]) : '',
            department: data.userType === 'faculty' ? (data.branch || BRANCH_OPTIONS[0]) : '',
          });
          setLoading(false);
        } else {
          console.error("No profile data found for user UID:", user.uid);
          alert("Error: Profile data not found. Logging out.");
          auth.signOut(); setLoading(false);
        }
      }, (error) => {
          console.error("Error fetching profile snapshot:", error);
          alert("Error loading profile. Please try refreshing or contact support.");
          setLoading(false); auth.signOut();
      });
      return () => unsubscribeProfile();
    } else {
      setUserProfile(null); setLoading(false);
    }
  }, [user]);

  // Attendance History Fetching
  useEffect(() => {
    if (user?.uid) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          const attendanceQuery = query(
            collection(firestore, 'attendance'),
            where('userId', '==', user.uid),
            where('date', '==', historyFilterDate),
            orderBy('checkInTime', 'asc')
          );
          const querySnapshot = await getDocs(attendanceQuery);
          const historyData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
          setAttendanceHistory(historyData);
        } catch (error) { console.error("Error fetching history:", error); }
        finally { setHistoryLoading(false); }
      };
      fetchHistory();
    } else { setAttendanceHistory([]); setHistoryLoading(false); }
  }, [user, historyFilterDate]);

  // Update Profile Handler
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    const updatedData: Partial<UserProfile> = {
      name: formData.name,
      mobileNumber: formData.mobileNumber,
      bloodGroup: formData.bloodGroup,
      photoUrl: formData.photoUrl ? convertGoogleDriveUrl(formData.photoUrl) : "",
      guardianNumber: formData.guardianNumber || undefined,
    };
    if (userProfile.userType === 'student') {
      updatedData.team = formData.team;
    } else {
      updatedData.branch = formData.department;
    }
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, updatedData);
      alert('Profile updated successfully!');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  // Helper function for URL conversion
  const convertGoogleDriveUrl = (url: string): string => {
        if (!url || !url.includes('drive.google.com')) return url;
        const match = url.match(/[-\w]{25,}/);
        if (match && match[0]) return `https://lh3.googleusercontent.com/d/${match[0]}`;
        console.warn("Could not extract Google Drive file ID from URL:", url);
        return url;
  };

  // Helper function for formatting dates/times
  const formatTimestamp = (timestamp: Timestamp | null, type: 'time' | 'date' = 'time') => {
      if (!timestamp) return 'In Lab';
      const date = timestamp.toDate();
      if (type === 'time') return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      else return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Loading State UI
  if (loading) {
     return ( <div className="flex justify-center items-center min-h-screen"><p className="text-lg font-semibold animate-pulse">Loading Profile...</p></div> );
  }

  // Error State UI
  if (!userProfile) {
     return ( <div className="flex flex-col justify-center items-center min-h-screen space-y-4 p-4 text-center"><p className="text-lg font-semibold text-red-600">Could not load profile data.</p><p className="text-sm text-gray-600">Please try again later or contact an administrator.</p><button onClick={() => auth.signOut()} className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Sign Out</button></div> );
  }

  const isAdmin = userProfile.permissionRole === 'admin' || userProfile.permissionRole === 'super-admin';

  // Helper component for perfectly aligned details from "old perfect code"
  const DetailRow = ({ label, value }: { label: string; value: string | undefined | null }) => (
    <div className="flex text-sm"> {/* Using text-sm from old code */}
        {/* Adjusted width to match the old code's alignment */}
        <span className="w-28 font-semibold opacity-70 flex-shrink-0 flex justify-between pr-2">
            <span>{label}</span>
            <span>:</span>
        </span>
        <span className="truncate flex-1 min-w-0">{value || 'N/A'}</span>
    </div>
  );

  // Determine Profile Image Source (using logic from previous correct version)
  let profileImageSrc = userProfile.photoUrl;
  let isPlaceholder = false;
  if (!profileImageSrc) {
    isPlaceholder = true;
    if (userProfile.userType === 'faculty') {
      profileImageSrc = FACULTY_PLACEHOLDER_URL;
    } else {
      const initial = userProfile.name?.[0]?.toUpperCase() || '?';
      profileImageSrc = `${STUDENT_PLACEHOLDER_BASE}${initial}`;
    }
  } else if (profileImageSrc.includes('placehold.co')) {
      isPlaceholder = true;
  }

  // Main Render
  return (
    <>
      <main className="flex flex-col items-center min-h-screen bg-gray-100 p-4 pt-10 pb-10">
        <div className="w-full max-w-md mx-auto space-y-6">

          {/* ----- RESTORED VIRTUAL ID CARD LAYOUT ----- */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white shadow-2xl overflow-hidden">
             {/* Main content padding - Adjusted to match old style */}
             <div className="p-6">
                {/* Header: Logo, Title, Status */}
                <div className="flex justify-between items-center"> {/* Use items-center from old */}
                    <Image
                        src="/logo/sae_logo_white.png"
                        alt="SAE CUSAT Logo"
                        width={70} height={35} priority
                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/70x35/cccccc/ffffff?text=Logo'; }}
                    />
                    <div className="text-right"> {/* Simplified from old */}
                        <span className="font-bold tracking-wider">{userProfile.displayTitle ? userProfile.displayTitle.toUpperCase() : userProfile.permissionRole.toUpperCase()}</span>
                        <div className={`mt-1 flex items-center justify-end space-x-2 text-xs font-medium px-2 py-0.5 rounded-full ${userProfile.isCheckedIn ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                            <div className={`w-2 h-2 rounded-full ${userProfile.isCheckedIn ? 'bg-green-900' : 'bg-red-900'}`}></div>
                            <span>{userProfile.isCheckedIn ? 'IN LAB' : 'NOT IN LAB'}</span>
                        </div>
                    </div>
                </div>

                {/* Profile Pic and Name/ID - Adjusted spacing */}
                <div className="flex items-center space-x-5 mt-6">
                    <Image
                        src={profileImageSrc}
                        alt="Profile Photo"
                        width={88} height={88}
                        className="rounded-full ring-4 ring-white/20 object-cover bg-gray-500 flex-shrink-0"
                        priority
                        unoptimized={isPlaceholder}
                        onError={(e) => {
                            let fallbackSrc = '';
                            if (userProfile.userType === 'faculty') { fallbackSrc = FACULTY_PLACEHOLDER_URL; }
                            else { const initial = userProfile.name?.[0]?.toUpperCase() || '?'; fallbackSrc = `${STUDENT_PLACEHOLDER_BASE}${initial}`; }
                            if (e.currentTarget.src !== fallbackSrc) { e.currentTarget.src = fallbackSrc; }
                        }}
                    />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold truncate">{userProfile.name}</h3>
                        <p className="text-sm font-mono opacity-80">{userProfile.saeId || 'Pending ID'}</p>
                    </div>
                </div>

                {/* Details Section - Using old structure with conditional rendering */}
                <div className="border-t border-white/20 pt-4 mt-6 space-y-2 text-sm">
                    {/* Conditional rendering based on userType */}
                    {userProfile.userType === 'student' && (
                        <>
                            <DetailRow label="Branch" value={userProfile.branch} />
                            <DetailRow label="Semester" value={userProfile.semester} />
                            {/* Team REMOVED from here, will be in highlighted section */}
                        </>
                    )}
                    {userProfile.userType === 'faculty' && (
                        <DetailRow label="Department" value={userProfile.branch} />
                    )}
                    {/* Common Details */}
                    <DetailRow label="Email" value={userProfile.email} />
                    <DetailRow label="Mobile" value={userProfile.mobileNumber} />
                    <DetailRow label="Blood Group" value={userProfile.bloodGroup} />
                    <DetailRow label={userProfile.userType === 'faculty' ? 'Emergency Ph' : 'Guardian Ph'} value={userProfile.guardianNumber} />
                </div>
            </div> {/* End of p-6 div */}

            {/* --- RESTORED Highlighted Team Section (Student Only) --- */}
            {userProfile.userType === 'student' && userProfile.team && (
              <div className="bg-white/10 rounded-b-2xl px-6 py-3 text-center">
                <span className="text-xs font-semibold tracking-widest opacity-70">TEAM</span>
                <p className="text-lg font-bold">{userProfile.team}</p>
              </div>
            )}
             {/* --- End of Highlighted Team Section --- */}
          </div>
          {/* ----- END OF VIRTUAL ID CARD ----- */}


          {/* Action Buttons (Using refined styles) */}
          <div className="p-4 bg-white rounded-lg shadow-md space-y-3">
             {isAdmin && (
                <Link href="/admin"
                 className="block w-full text-center px-4 py-3 font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-md hover:shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 ease-in-out"
                 >
                  Admin Dashboard
                </Link>
             )}
             <button
                onClick={() => setIsEditModalOpen(true)}
                className="block w-full px-4 py-2 font-semibold text-sm text-indigo-700 bg-indigo-100 rounded-lg shadow-sm hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 ease-in-out"
              >
                Edit Profile
             </button>
             <button
                onClick={() => auth.signOut()}
                className="block w-full px-4 py-2 font-semibold text-sm text-gray-700 bg-gray-200 rounded-lg shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-150 ease-in-out"
             >
                Sign Out
             </button>
          </div>

          {/* Attendance History Section (remains the same) */}
          <div className="p-6 bg-white rounded-lg shadow-md">
             <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
               <h3 className="text-lg sm:text-xl font-bold text-gray-800">My Attendance History</h3>
               <input type="date" value={historyFilterDate} onChange={(e) => setHistoryFilterDate(e.target.value)} className="border rounded-md px-2 py-1 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500" max={new Date().toISOString().split('T')[0]}/>
            </div>
            {historyLoading ? ( <p className="text-gray-500 text-center py-4">Loading history...</p> )
            : attendanceHistory.length > 0 ? (
              <div className="overflow-x-auto max-h-60 border rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 sticky top-0 z-10"><tr><th className="p-2 font-semibold text-gray-600">Date</th><th className="p-2 font-semibold text-gray-600">Check In</th><th className="p-2 font-semibold text-gray-600">Check Out</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {attendanceHistory.map(record => ( <tr key={record.id} className="hover:bg-gray-50"><td className="p-2 text-gray-700">{formatTimestamp(record.checkInTime, 'date')}</td><td className="p-2 text-gray-700">{formatTimestamp(record.checkInTime, 'time')}</td><td className="p-2 text-gray-700">{formatTimestamp(record.checkOutTime, 'time')}</td></tr> ))}
                  </tbody>
                </table>
              </div>
            ) : ( <p className="text-gray-500 text-center py-4">No attendance records found for {new Date(historyFilterDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.</p> )}
          </div>
        </div>
      </main>

      {/* Edit Profile Modal (remains the same) */}
      {isEditModalOpen && userProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-lg p-6 sm:p-8 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
             <h2 className="text-2xl font-bold mb-4 text-gray-800">Edit Your Profile</h2>
             {/* Common fields */}
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-style"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label><input type="tel" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} className="input-style"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label><input type="text" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className="input-style"/></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Photo URL</label><input type="url" value={formData.photoUrl} onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })} className="input-style"/> <p className="mt-1 text-xs text-gray-500">Paste a public link (e.g., from Google Drive, set to 'Anyone with the link').</p></div>
            {/* Conditional Fields */}
            {userProfile.userType === 'student' && ( <> <div><label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label><select value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })} className="input-style"><option value="" disabled={!!formData.team}>Select Team</option>{TEAM_OPTIONS.map(team => <option key={team} value={team}>{team}</option>)}</select></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian's Number</label><input type="tel" value={formData.guardianNumber} onChange={(e) => setFormData({ ...formData, guardianNumber: e.target.value })} className="input-style"/></div> </> )}
            {userProfile.userType === 'faculty' && ( <> <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="input-style"><option value="" disabled={!!formData.department}>Select Department</option>{BRANCH_OPTIONS.map(dept => <option key={dept} value={dept}>{dept}</option>)}</select></div> <div><label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (Optional)</label><input type="tel" value={formData.guardianNumber} onChange={(e) => setFormData({ ...formData, guardianNumber: e.target.value })} className="input-style"/></div> </> )}
            {/* Buttons */}
            <div className="flex justify-end space-x-4 pt-4"> <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">Cancel</button> <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors">Save Changes</button> </div>
          </form>
        </div>
      )}
      {/* Include Style definitions */}
       <style jsx global>{`
              .input-style { display: block; width: 100%; height: 2.75rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; appearance: none; background-color: #fff; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; }
              .input-style:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #4F46E5; box-shadow: 0 0 0 3px rgb(79 70 229 / 0.2); }
              select.input-style { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-right: 2.5rem; }
            `}</style>
    </>
  );
}

