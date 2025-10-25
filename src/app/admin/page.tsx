'use client';

import { useEffect, useState, FormEvent, useMemo } from 'react';
import { auth, firestore } from '../../firebase'; // Correct path assumed
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  Timestamp,
  updateDoc,
  deleteDoc,
  runTransaction,
  orderBy,
  DocumentReference, // Import DocumentReference type
  DocumentData     // Import DocumentData type
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// --- Type Definitions ---
type UserProfile = {
  id: string;
  name: string;
  saeId: string | null;
  email: string;
  userType: 'student' | 'faculty';
  branch?: string; // Also used for faculty department
  joinYear?: string; // Student only
  semester?: string; // Student only
  team?: string; // Student only
  guardianNumber?: string; // Optional for faculty
  bloodGroup: string;
  mobileNumber: string;
  photoUrl: string;
  permissionRole: 'student' | 'admin' | 'super-admin';
  displayTitle: string;
  accountStatus: 'pending' | 'approved' | 'rejected';
  isCheckedIn: boolean;
};

type AttendanceRecord = {
  id: string;
  userName: string;
  saeId: string; // Should exist on approved users' records
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
  date: string;
};

type LiveUser = {
  id: string;
  name: string;
};

// --- NEW: Define type for counter documents ---
type CounterData = {
  count: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Live Status State
  const [labIsOpen, setLabIsOpen] = useState(false);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);

  // History State
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // User Management State
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // --- useEffect hooks remain the same ---
  useEffect(() => { // Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        // Ensure user exists in Firestore and has an admin role
        if (userDoc.exists() && ['admin', 'super-admin'].includes(userDoc.data().permissionRole)) {
          setUser(currentUser);
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
        } else {
          // If Firestore doc missing or role incorrect, deny access
          if(typeof window !== 'undefined' && window.location.pathname !== '/profile') {
            alert('Access Denied. Admin privileges required or profile missing.');
            router.push('/profile');
          } else {
             // Avoid redirect loop if already on profile, maybe just sign out
             auth.signOut();
             router.push('/');
          }
        }
      } else {
        // If not authenticated, redirect to login
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => { // Data listeners (run only when authenticated admin user exists)
    if (!user || !userProfile) return; // Ensure user and profile are loaded

    // Listener for live lab status
    const labStatusUnsub = onSnapshot(doc(firestore, 'labStatus', 'current'), (docSnap) => {
      const data = docSnap.data();
      setLabIsOpen(data?.isLabOpen || false);
      setLiveUsers(data?.currentlyCheckedIn || []);
    }, (error) => { console.error("Error listening to lab status:", error); });

    // Listener for pending users
    const pendingQuery = query(collection(firestore, 'users'), where('accountStatus', '==', 'pending'));
    const pendingUnsub = onSnapshot(pendingQuery, (snapshot) => {
      const pUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setPendingUsers(pUsers);
    }, (error) => { console.error("Error listening to pending users:", error); });

    // Listener for all users (Admin and Super-Admin)
    // Security rules already ensure only admins/super-admins can list users
    const allUsersQuery = query(collection(firestore, 'users'), orderBy('name'));
    const allUsersUnsub = onSnapshot(allUsersQuery, (snapshot) => {
      const aUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setAllUsers(aUsers);
    }, (error) => {
      console.error("Error fetching all users:", error);
      // Check for permission errors specifically
       if (error.code === 'permission-denied') {
          alert("Permission denied fetching user list. Please check Firestore rules.");
      }
    });

    // Cleanup listeners on component unmount
    return () => {
      labStatusUnsub();
      pendingUnsub();
      allUsersUnsub();
    };
  }, [user, userProfile]); // Depend on user and userProfile

  // Listener for attendance history based on selected date
  useEffect(() => {
    if (!user) return; // Only run if user is logged in
    // Security rules handle admin permission check for this query
    const attendanceQuery = query(
      collection(firestore, 'attendance'),
      where('date', '==', historyDate),
      orderBy('checkInTime', 'asc')
    );
    const historyUnsub = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setHistory(records);
    }, (error) => {
        console.error("Error fetching attendance history: ", error);
        if (error.code === 'permission-denied') {
            alert("Permission denied fetching attendance history.");
        } else if (error.code === 'failed-precondition') {
            console.warn("Index required for attendance history query. Please create it using the link in the console error.");
            // Optionally, set an error state to inform the admin
        }
    });
    // Cleanup listener
    return () => historyUnsub();
  }, [user, historyDate]); // Depend on user and selected historyDate

  // --- Memoized Filtered Lists ---
  const filteredHistory = useMemo(() => {
    if (!historySearchTerm) return history;
    const lowerCaseSearch = historySearchTerm.toLowerCase();
    return history.filter(rec =>
      rec.userName?.toLowerCase().includes(lowerCaseSearch) ||
      (rec.saeId && rec.saeId.toLowerCase().includes(lowerCaseSearch))
    );
  }, [history, historySearchTerm]);

  const filteredPendingUsers = useMemo(() => {
    if (!pendingSearchTerm) return pendingUsers;
    const lowerCaseSearch = pendingSearchTerm.toLowerCase();
    return pendingUsers.filter(user =>
      user.name?.toLowerCase().includes(lowerCaseSearch) ||
      user.email?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [pendingUsers, pendingSearchTerm]);

  const filteredAllUsers = useMemo(() => {
    if (!userSearchTerm) return allUsers;
    const lowerCaseSearch = userSearchTerm.toLowerCase();
    return allUsers.filter(user =>
      user.name?.toLowerCase().includes(lowerCaseSearch) ||
      (user.saeId && user.saeId.toLowerCase().includes(lowerCaseSearch)) ||
      user.email?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [allUsers, userSearchTerm]);

  // --- Action Handlers ---

  const handleApprove = async (pendingUser: UserProfile) => {
    if (!window.confirm(`Approve ${pendingUser.name}? An SAE ID will be generated.`)) return;

    let newSaeId = '';
    // --- FIX 1: Explicitly type counterRef ---
    let counterRef: DocumentReference<DocumentData>;
    let serialNumber: number = 0;

    try {
        // --- ID Generation Logic ---
        if (pendingUser.userType === 'faculty') {
            // Explicit type casting
            counterRef = doc(firestore, 'counters', 'FACULTY') as DocumentReference<CounterData>;
            await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                // --- FIX 2: Use optional chaining and default value ---
                serialNumber = (counterDoc.exists() ? (counterDoc.data()?.count || 0) : 0) + 1;
                transaction.set(counterRef, { count: serialNumber }, { merge: true });
            });
             if (serialNumber <= 0) throw new Error("Faculty serial number generation failed.");
            newSaeId = `SAEFAC${serialNumber.toString().padStart(3, '0')}`;

        } else { // Assume student
            if (!pendingUser.branch || !pendingUser.joinYear) {
                throw new Error("Student data (branch or join year) is missing. Cannot generate ID.");
            }

            // Branch Code Mapping
            let branchCode = '';
            switch(pendingUser.branch.toUpperCase()) {
                case 'EEE': branchCode = 'EE'; break;
                case 'ECE': branchCode = 'EC'; break;
                // ... other cases ...
                case 'ME': branchCode = 'ME'; break;
                case 'CS': branchCode = 'CS'; break;
                case 'IT': branchCode = 'IT'; break;
                case 'CE': branchCode = 'CE'; break;
                case 'SF': branchCode = 'SF'; break;
                default: branchCode = 'XX'; console.warn(`Unknown branch: ${pendingUser.branch}`);
            }

            const year = pendingUser.joinYear;
            // Explicit type casting
            counterRef = doc(firestore, 'counters', `${branchCode}${year}`) as DocumentReference<CounterData>;

            await runTransaction(firestore, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                 // --- FIX 2: Use optional chaining and default value ---
                serialNumber = (counterDoc.exists() ? (counterDoc.data()?.count || 0) : 0) + 1;
                transaction.set(counterRef, { count: serialNumber }, { merge: true });
            });
            if (serialNumber <= 0) throw new Error("Student serial number generation failed.");
            newSaeId = `SAE${branchCode}${year}${serialNumber.toString().padStart(3, '0')}`;
        }
        // --- End ID Generation Logic ---

        // Update the user document
        const userDocRef = doc(firestore, 'users', pendingUser.id);
        await updateDoc(userDocRef, {
            accountStatus: 'approved',
            saeId: newSaeId,
        });

        alert(`User approved! Their new SAE ID is: ${newSaeId}`);

    } catch (error) {
        console.error("Approval error:", error);
        alert(`Error approving user: ${(error as Error).message}`);
    }
};

  const handleReject = async (userId: string) => {
     if (!window.confirm("Reject user? This deletes their registration data.")) return;
    try {
        const userDocRef = doc(firestore, 'users', userId);
        await deleteDoc(userDocRef);
        alert('User rejected and data deleted. Remember to delete their login from Firebase Authentication manually.');
    } catch (error) {
        console.error("Rejection error:", error);
        alert('Error rejecting user.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) {
        console.error("Attempted to delete but deletingUser is null");
        return;
    }
    if (!deletingUser.saeId || deleteConfirmText !== deletingUser.saeId) {
      alert("SAE ID does not match or is missing/pending. Deletion cancelled.");
      return;
    }
    if (!window.confirm(`FINAL CONFIRMATION: Delete ${deletingUser.name}? This cannot be undone.`)) return;

    try {
      const userDocRef = doc(firestore, 'users', deletingUser.id);
      await deleteDoc(userDocRef);
      alert(`User ${deletingUser.name} deleted successfully. Remember to manually delete their login from Firebase Authentication.`);
      setDeletingUser(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error("Deletion error:", error);
      alert('Error deleting user.');
    }
  };

  const handleUpdateUser = async (e: FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      if (userProfile?.permissionRole !== 'super-admin') {
          alert("Only Super Admins can edit user roles/titles.");
          return;
      }
      try {
          const userDocRef = doc(firestore, 'users', editingUser.id);
          await updateDoc(userDocRef, {
              permissionRole: editingUser.permissionRole,
              displayTitle: editingUser.displayTitle,
          });
          alert("User updated successfully.");
          setEditingUser(null);
      } catch (error) {
          console.error("User update error:", error);
          alert("Failed to update user.");
      }
  };

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'In Lab';
    return timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };


  if (loading) return <div className="flex justify-center items-center min-h-screen"><p>Loading Admin Dashboard...</p></div>;

  // Render JSX (No changes needed in the JSX structure for this update)
  return (
    <>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <header className="flex flex-wrap justify-between items-center gap-4">
             <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              {/* Added optional chaining for safety */}
              <p className="text-gray-600">Welcome, {userProfile?.name} ({userProfile?.permissionRole})</p>
            </div>
            <button onClick={() => router.push('/profile')} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">My Profile</button>
          </header>

          {/* Live Status and History Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Live Status Column */}
            <div className="md:col-span-1 space-y-6">
              {/* Cards remain the same */}
               <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Live Lab Status</h3>
                <div className={`mt-4 text-3xl font-bold flex items-center ${labIsOpen ? 'text-green-600' : 'text-red-600'}`}>
                  <span className={`w-4 h-4 rounded-full mr-3 ${labIsOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {labIsOpen ? 'OPEN' : 'CLOSED'}
                </div>
                <p className="text-gray-500 mt-2">{liveUsers.length} {liveUsers.length === 1 ? 'person' : 'people'} currently in lab.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Currently in Lab</h3>
                {liveUsers.length > 0 ? ( <ul className="mt-4 space-y-2 text-gray-700 max-h-40 overflow-y-auto">{liveUsers.map(liveUser => <li key={liveUser.id}>{liveUser.name}</li>)}</ul>)
                 : (<p className="mt-4 text-gray-500">The lab is currently empty.</p>)}
              </div>
            </div>

            {/* Attendance History Card */}
            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
               <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Attendance History</h3>
                <div className="flex items-center gap-4">
                  {/* History Search Input */}
                  <input type="text" placeholder="Search Name/ID..." value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} className="input-style w-40"/>
                  <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="input-style"/>
                </div>
              </div>
              <div className="overflow-x-auto max-h-96 border rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 sticky top-0 z-10"><tr>
                    <th className="p-3 font-semibold text-gray-600">Name</th>
                    <th className="p-3 font-semibold text-gray-600">SAE ID</th>
                    <th className="p-3 font-semibold text-gray-600">Check In</th>
                    <th className="p-3 font-semibold text-gray-600">Check Out</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Use filteredHistory */}
                    {filteredHistory.map(rec => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="p-3">{rec.userName}</td>
                        <td className="p-3">{rec.saeId}</td>
                        <td className="p-3">{formatDate(rec.checkInTime)}</td>
                        <td className="p-3">{formatDate(rec.checkOutTime)}</td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                        <tr><td colSpan={4} className="text-center text-gray-500 py-8">No records found {historySearchTerm ? 'matching search' : 'for this date'}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pending Approvals Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
             <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Pending Approvals ({filteredPendingUsers.length})</h3>
              <input type="text" placeholder="Search Name/Email..." value={pendingSearchTerm} onChange={(e) => setPendingSearchTerm(e.target.value)} className="input-style w-full sm:w-48"/>
            </div>
             {pendingUsers.length === 0 ? (<p className="text-gray-500">No new members awaiting approval.</p>)
             : filteredPendingUsers.length === 0 ? (<p className="text-center text-gray-500 py-4">No pending users match your search.</p>)
             : (
                <div className="overflow-x-auto border rounded-md -mx-6 sm:mx-0">
                  <table className="w-full text-sm text-left min-w-[640px]">
                    <thead className="bg-gray-100"><tr>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Name</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Email</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Branch/Dept</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Use filteredPendingUsers */}
                      {filteredPendingUsers.map(pUser => (
                        <tr key={pUser.id} className="hover:bg-gray-50">
                          <td className="p-2 sm:p-3 whitespace-nowrap">{pUser.name}</td>
                          <td className="p-2 sm:p-3 whitespace-nowrap text-xs sm:text-sm">{pUser.email}</td>
                          <td className="p-2 sm:p-3 capitalize whitespace-nowrap">{pUser.userType}</td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">{pUser.branch || 'N/A'}</td>
                          <td className="p-2 sm:p-3">
                            <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                              <button onClick={() => setViewingUser(pUser)} className="text-xs text-blue-600 hover:underline">View</button>
                              <button onClick={() => handleApprove(pUser)} className="text-xs text-green-600 hover:underline">Approve</button>
                              <button onClick={() => handleReject(pUser.id)} className="text-xs text-red-600 hover:underline">Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>

          {/* User Management Card */}
          {(userProfile?.permissionRole === 'admin' || userProfile?.permissionRole === 'super-admin') && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-800">User Management ({filteredAllUsers.length})</h3>
                <input type="text" placeholder="Search Name/ID/Email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="input-style w-full sm:w-56"/>
              </div>
              {allUsers.length === 0 ? (<p className="text-gray-500">No users found in the system yet.</p>)
              : filteredAllUsers.length === 0 ? (<p className="text-center text-gray-500 py-4">No users match your search.</p>)
              : (
                <div className="overflow-x-auto border rounded-md -mx-6 sm:mx-0">
                  <table className="w-full text-sm text-left min-w-[640px]">
                    <thead className="bg-gray-100"><tr>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Name</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">SAE ID</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Team</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Role</th>
                        <th className="p-2 sm:p-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Use filteredAllUsers */}
                      {filteredAllUsers.map(aUser => (
                        <tr key={aUser.id} className="hover:bg-gray-50">
                          <td className="p-2 sm:p-3 whitespace-nowrap">{aUser.name}</td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">{aUser.saeId || 'Pending'}</td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">{aUser.team || 'N/A'}</td>
                          <td className="p-2 sm:p-3 whitespace-nowrap text-xs">{aUser.permissionRole}</td>
                          <td className="p-2 sm:p-3">
                            <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                              <button onClick={() => setViewingUser(aUser)} className="text-xs text-blue-600 hover:underline">View</button>
                              {userProfile?.permissionRole === 'super-admin' && (
                                  <button onClick={() => setEditingUser(aUser)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                              )}
                              <button onClick={() => setDeletingUser(aUser)} className="text-xs text-red-600 hover:underline">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- Modals --- */}
      {/* View User Details Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingUser(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
            <h2 className="text-xl font-bold mb-4 text-gray-800">{viewingUser.name}&apos;s Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-700">
                <div className="sm:col-span-2 flex justify-center mb-4">
                  {viewingUser.photoUrl && !viewingUser.photoUrl.includes('i.pravatar.cc') ? (
                    <Image 
                      src={viewingUser.photoUrl} 
                      alt="Profile" 
                      width={100} 
                      height={100} 
                      className="rounded-full object-cover ring-2 ring-gray-300 bg-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="w-[100px] h-[100px] rounded-full ring-2 ring-gray-300 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center"><span class="text-4xl font-bold text-white">${viewingUser.name?.[0]?.toUpperCase() || '?'}</span></div>`;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-[100px] h-[100px] rounded-full ring-2 ring-gray-300 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {viewingUser.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
                <p><strong>Type:</strong> <span className="capitalize">{viewingUser.userType}</span></p>
                <p><strong>SAE ID:</strong> {viewingUser.saeId || <span className="italic text-gray-500">Pending</span>}</p>
                {viewingUser.userType === 'student' && <p><strong>Team:</strong> {viewingUser.team || 'N/A'}</p>}
                <p><strong>Email:</strong> {viewingUser.email}</p>
                <p><strong>{viewingUser.userType === 'faculty' ? 'Department' : 'Branch'}:</strong> {viewingUser.branch || 'N/A'}</p>
                {viewingUser.userType === 'student' && <p><strong>Semester:</strong> {viewingUser.semester || 'N/A'}</p>}
                <p><strong>Mobile:</strong> {viewingUser.mobileNumber || 'N/A'}</p>
                <p><strong>{viewingUser.userType === 'faculty' ? 'Emergency Contact' : 'Guardian'}:</strong> {viewingUser.guardianNumber || 'N/A'}</p>
                <p><strong>Blood Group:</strong> {viewingUser.bloodGroup || 'N/A'}</p>
                <p><strong>Permission Role:</strong> {viewingUser.permissionRole}</p>
                <p><strong>Display Title:</strong> {viewingUser.displayTitle || 'N/A'}</p>
                <p><strong>Account Status:</strong> <span className={`font-semibold ${viewingUser.accountStatus === 'approved' ? 'text-green-600' : viewingUser.accountStatus === 'pending' ? 'text-orange-600' : 'text-red-600'}`}>{viewingUser.accountStatus}</span></p>
                <p className="sm:col-span-2"><strong>Photo URL:</strong> {viewingUser.photoUrl ? <a href={viewingUser.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 break-all hover:underline">{viewingUser.photoUrl}</a> : 'Not provided'}</p>
            </div>
            <div className="mt-6 text-right">
              <button onClick={() => setViewingUser(null)} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit User Modal (Super Admin only) */}
      {editingUser && userProfile?.permissionRole === 'super-admin' && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleUpdateUser} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
             <h2 className="text-2xl font-bold mb-4 text-gray-800">Edit {editingUser.name}</h2>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Permission Role</label><select value={editingUser.permissionRole} onChange={e => setEditingUser({...editingUser, permissionRole: e.target.value as UserProfile['permissionRole']})} className="input-style"><option value="student">student</option><option value="admin">admin</option><option value="super-admin">super-admin</option></select></div>
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Display Title</label><input type="text" value={editingUser.displayTitle} onChange={e => setEditingUser({...editingUser, displayTitle: e.target.value})} className="input-style"/></div>
             <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">Cancel</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors">Save Changes</button></div>
          </form>
        </div>
      )}
       {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
             <h2 className="text-2xl font-bold text-red-600 mb-4">Confirm Deletion</h2>
             <p className="text-gray-700">Are you sure you want to delete <span className="font-bold">{deletingUser.name}</span> ({deletingUser.saeId || 'Pending ID'})?</p>
             <p className="text-sm text-gray-600">This action will remove their profile data from Firestore. Their login account must be manually deleted from Firebase Authentication later.</p>
             <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">To confirm, please type the user&apos;s SAE ID ({deletingUser.saeId || 'ID Pending'}):</label>
                <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} className="input-style" placeholder={deletingUser.saeId || 'Pending ID'} disabled={!deletingUser.saeId}/>
             </div>
             <div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={() => { setDeletingUser(null); setDeleteConfirmText(''); }} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">Cancel</button><button type="button" onClick={handleDeleteUser} disabled={!deletingUser.saeId || deleteConfirmText !== deletingUser.saeId} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">Delete User Data</button></div>
          </div>
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

