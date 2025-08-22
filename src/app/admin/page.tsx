// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
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

type AttendanceRecord = {
  id: string;
  userName: string;
  saeId: string;
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
};

type ManagedUser = {
    id: string;
    name: string;
    saeId: string;
    role: 'student' | 'admin' | 'super-admin';
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [labStatus, setLabStatus] = useState<LabStatus>({ isLabOpen: false, currentlyCheckedIn: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // --- Main Authentication useEffect ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          setUserProfile(profile);
          if (profile.role === 'admin' || profile.role === 'super-admin') {
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

  // --- Real-time Listeners and Data Fetchers ---
  useEffect(() => {
    if (!user) return;

    // Lab Status Listener
    const labStatusRef = doc(firestore, 'labStatus', 'current');
    const unsubscribeStatus = onSnapshot(labStatusRef, (doc) => {
      setLabStatus(doc.exists() ? (doc.data() as LabStatus) : { isLabOpen: false, currentlyCheckedIn: [] });
    });

    // Attendance History Listener
    setHistoryLoading(true);
    const historyQuery = query(collection(firestore, 'attendance'), where('date', '==', selectedDate));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendanceHistory(records);
      setHistoryLoading(false);
    });

    // Fetch all users if super-admin
    if (userProfile?.role === 'super-admin') {
        fetchAllUsers();
    }

    return () => {
      unsubscribeStatus();
      unsubscribeHistory();
    };
  }, [user, selectedDate, userProfile]);

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    const usersQuery = query(collection(firestore, 'users'));
    const querySnapshot = await getDocs(usersQuery);
    const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManagedUser));
    setAllUsers(usersList);
    setUsersLoading(false);
  };

  const handleRoleChange = async (targetUserId: string, newRole: 'admin' | 'student') => {
    if (userProfile?.role !== 'super-admin') {
        alert("You do not have permission to perform this action.");
        return;
    }
    try {
        const userDocRef = doc(firestore, 'users', targetUserId);
        await updateDoc(userDocRef, { role: newRole });
        // Refresh the user list to show the change
        fetchAllUsers();
        alert("User role updated successfully.");
    } catch (error) {
        console.error("Error updating user role:", error);
        alert("Failed to update user role.");
    }
  };


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
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700">Currently In Lab</h2>
              <div className="mt-4 h-40 overflow-y-auto">
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

          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Attendance History</h2>
            <div className="flex items-center space-x-4 mb-4">
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SAE ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyLoading ? (
                    <tr><td colSpan={4} className="text-center py-4">Loading records...</td></tr>
                  ) : attendanceHistory.length > 0 ? (
                    attendanceHistory.map(record => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{record.userName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{record.saeId}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{record.checkInTime.toDate().toLocaleTimeString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.checkOutTime ? record.checkOutTime.toDate().toLocaleTimeString() : 'Still in lab'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-500">No records found for this date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Management Card (Super Admin Only) */}
          {userProfile?.role === 'super-admin' && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">User Management</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SAE ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usersLoading ? (
                      <tr><td colSpan={4} className="text-center py-4">Loading users...</td></tr>
                    ) : (
                      allUsers.map(managedUser => (
                        <tr key={managedUser.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{managedUser.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{managedUser.saeId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{managedUser.role}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {managedUser.role === 'student' && (
                              <button onClick={() => handleRoleChange(managedUser.id, 'admin')} className="text-indigo-600 hover:text-indigo-900">Make Admin</button>
                            )}
                            {managedUser.role === 'admin' && (
                              <button onClick={() => handleRoleChange(managedUser.id, 'student')} className="text-red-600 hover:text-red-900">Make Student</button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return null;
}
