'use client';

import { useEffect, useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase';
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
  orderBy
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  team: string;
};

type AttendanceRecord = {
  id: string;
  userName: string;
  saeId: string;
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
};

type LiveUser = {
  id: string;
  name: string;
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

  // User Management State
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && ['admin', 'super-admin'].includes(userDoc.data().permissionRole)) {
          setUser(currentUser);
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
        } else {
          alert('Access Denied. You do not have admin privileges.');
          router.push('/profile');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    // Listener for live lab status
    const labStatusUnsub = onSnapshot(doc(firestore, 'labStatus', 'current'), (doc) => {
      const data = doc.data();
      setLabIsOpen(data?.isLabOpen || false);
      setLiveUsers(data?.currentlyCheckedIn || []);
    });

    // Listener for pending users
    const pendingQuery = query(collection(firestore, 'users'), where('accountStatus', '==', 'pending'));
    const pendingUnsub = onSnapshot(pendingQuery, (snapshot) => {
      const pUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setPendingUsers(pUsers);
    });
    
    // Listener for all users (Admin and Super-Admin)
    const allUsersQuery = query(collection(firestore, 'users'), orderBy('name'));
    const allUsersUnsub = onSnapshot(allUsersQuery, (snapshot) => {
      const aUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setAllUsers(aUsers);
    }, (error) => {
      console.error("Error fetching all users:", error); // Check for permissions error here
      // Handle the error appropriately, e.g., show a message to the user
    });

    // Cleanup listeners on component unmount
    return () => {
      labStatusUnsub();
      pendingUnsub();
      allUsersUnsub();
    };
  }, [user]);

  // Listener for attendance history based on selected date
  useEffect(() => {
    if (!user) return;
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
    });
    return () => historyUnsub();
  }, [user, historyDate]);
  
  const handleApprove = async (pendingUser: UserProfile) => {
    if (!window.confirm(`Are you sure you want to approve ${pendingUser.name}? An SAE ID will be generated.`)) return;
    
    try {
      const branchCode = pendingUser.branch.toUpperCase();
      const year = pendingUser.joinYear; // Assuming joinYear is '25' format
      const counterRef = doc(firestore, 'counters', `${branchCode}${year}`);
      
      let serialNumber: number;
      await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        serialNumber = (counterDoc.exists() ? counterDoc.data().count : 0) + 1;
        transaction.set(counterRef, { count: serialNumber }, { merge: true });
      });

      if (serialNumber! === undefined) throw new Error("Could not generate serial number.");

      const paddedSerial = serialNumber!.toString().padStart(3, '0');
      const newSaeId = `SAE${branchCode}${year}${paddedSerial}`;

      const userDocRef = doc(firestore, 'users', pendingUser.id);
      await updateDoc(userDocRef, { 
        accountStatus: 'approved',
        saeId: newSaeId,
      });
      
      alert(`User approved! Their new SAE ID is: ${newSaeId}`);
      
    } catch (error) {
        console.error("Approval error:", error);
        alert('Error approving user.');
    }
  };

  const handleReject = async (userId: string) => {
     if (!window.confirm("Are you sure? This will delete the user's registration data.")) return;
    try {
        const userDocRef = doc(firestore, 'users', userId);
        await deleteDoc(userDocRef);
        alert('User rejected and data deleted. Their login account must be deleted from the Authentication console manually.');
    } catch (error) {
        console.error("Rejection error:", error);
        alert('Error rejecting user.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || deleteConfirmText !== deletingUser.saeId) {
      alert("SAE ID does not match. Deletion cancelled.");
      return;
    }
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

  return (
    <>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {userProfile?.name} ({userProfile?.permissionRole})</p>
            </div>
            <button onClick={() => router.push('/profile')} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">My Profile</button>
          </header>

          {/* Live Status and History Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              {/* Live Lab Status Card */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Live Lab Status</h3>
                <div className={`mt-4 text-3xl font-bold flex items-center ${labIsOpen ? 'text-green-600' : 'text-red-600'}`}>
                  <span className={`w-4 h-4 rounded-full mr-3 ${labIsOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {labIsOpen ? 'OPEN' : 'CLOSED'}
                </div>
                <p className="text-gray-500 mt-2">{liveUsers.length} {liveUsers.length === 1 ? 'person' : 'people'} currently in lab.</p>
              </div>
              
              {/* Currently in Lab Card */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-800">Currently in Lab</h3>
                {liveUsers.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-gray-700 max-h-40 overflow-y-auto">
                    {liveUsers.map(liveUser => <li key={liveUser.id}>{liveUser.name}</li>)}
                  </ul>
                ) : (
                  <p className="mt-4 text-gray-500">The lab is currently empty.</p>
                )}
              </div>
            </div>

            {/* Attendance History Card */}
            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Attendance History</h3>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="border rounded-md px-2 py-1"/>
              </div>
              <div className="overflow-x-auto max-h-96"> {/* Added max-height and overflow */}
                <table className="w-full text-sm text-left">
                  {/* CORRECTED: Removed whitespace before <tr> */}
                  <thead className="bg-gray-100 sticky top-0"><tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">SAE ID</th>
                    <th className="p-3">Check In</th>
                    <th className="p-3">Check Out</th>
                  </tr></thead>
                  <tbody>
                    {history.map(rec => (
                      <tr key={rec.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{rec.userName}</td>
                        <td className="p-3">{rec.saeId}</td>
                        <td className="p-3">{formatDate(rec.checkInTime)}</td>
                        <td className="p-3">{formatDate(rec.checkOutTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                 {history.length === 0 && <p className="text-center text-gray-500 py-8">No records found for this date.</p>}
              </div>
            </div>
          </div>

          {/* Pending Approvals Card */}
          <div className="bg-white p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Approvals ({pendingUsers.length})</h3>
             {pendingUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    {/* CORRECTED: Removed whitespace before <tr> */}
                    <thead><tr className="bg-gray-100"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Branch</th><th className="p-3">Actions</th></tr></thead>
                    <tbody>
                      {pendingUsers.map(pUser => (
                        <tr key={pUser.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">{pUser.name}</td>
                          <td className="p-3">{pUser.email}</td>
                          <td className="p-3">{pUser.branch}</td>
                          <td className="p-3 flex flex-wrap gap-2">
                            <button onClick={() => setViewingUser(pUser)} className="text-xs text-blue-600 hover:underline">View</button>
                            <button onClick={() => handleApprove(pUser)} className="text-xs text-green-600 hover:underline">Approve</button>
                            <button onClick={() => handleReject(pUser.id)} className="text-xs text-red-600 hover:underline">Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             ) : <p className="text-gray-500">No new members awaiting approval.</p>}
          </div>

          {/* User Management Card (Visible to Admin and Super-Admin) */}
          {(userProfile?.permissionRole === 'admin' || userProfile?.permissionRole === 'super-admin') && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">User Management</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  {/* CORRECTED: Removed whitespace before <tr> */}
                  <thead><tr className="bg-gray-100"><th className="p-3">Name</th><th className="p-3">SAE ID</th><th className="p-3">Team</th><th className="p-3">Role</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>
                    {allUsers.map(aUser => (
                      <tr key={aUser.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{aUser.name}</td>
                        <td className="p-3">{aUser.saeId || 'Pending'}</td>
                        <td className="p-3">{aUser.team}</td>
                        <td className="p-3">{aUser.permissionRole}</td>
                        <td className="p-3 flex flex-wrap gap-2">
                          <button onClick={() => setViewingUser(aUser)} className="text-xs text-blue-600 hover:underline">View</button>
                          {/* Only show Edit button to Super Admin */}
                          {userProfile?.permissionRole === 'super-admin' && (
                              <button onClick={() => setEditingUser(aUser)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                          )}
                          <button onClick={() => setDeletingUser(aUser)} className="text-xs text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Modals --- */}
      
      {/* View User Details Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingUser(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
            <h2 className="text-2xl font-bold mb-4">{viewingUser.name}'s Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                {/* Profile Photo */}
                {viewingUser.photoUrl && (
                  <div className="sm:col-span-2 flex justify-center mb-4">
                     <Image 
                       src={viewingUser.photoUrl} 
                       alt="Profile" 
                       width={100} 
                       height={100} 
                       className="rounded-full object-cover ring-2 ring-gray-300"
                     />
                  </div>
                )}
                <p><strong>SAE ID:</strong> {viewingUser.saeId || 'Pending'}</p>
                <p><strong>Team:</strong> {viewingUser.team || 'N/A'}</p>
                <p><strong>Email:</strong> {viewingUser.email}</p>
                <p><strong>Branch:</strong> {viewingUser.branch}</p>
                <p><strong>Semester:</strong> {viewingUser.semester}</p>
                <p><strong>Mobile:</strong> {viewingUser.mobileNumber}</p>
                <p><strong>Guardian:</strong> {viewingUser.guardianNumber}</p>
                <p><strong>Blood Group:</strong> {viewingUser.bloodGroup}</p>
                <p><strong>Role:</strong> {viewingUser.permissionRole}</p>
                <p><strong>Title:</strong> {viewingUser.displayTitle}</p>
                <p><strong>Status:</strong> {viewingUser.accountStatus}</p>
                <p className="sm:col-span-2"><strong>Photo URL:</strong> <a href={viewingUser.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 break-all">{viewingUser.photoUrl || 'Not provided'}</a></p>
            </div>
            <button onClick={() => setViewingUser(null)} className="mt-6 px-4 py-2 bg-gray-200 rounded-md w-full sm:w-auto">Close</button>
          </div>
        </div>
      )}
      
      {/* Edit User Modal (Super Admin only) */}
      {editingUser && userProfile?.permissionRole === 'super-admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateUser} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl space-y-4">
             <h2 className="text-2xl font-bold mb-4">Edit {editingUser.name}</h2>
             <div>
                <label className="block text-sm font-medium text-gray-700">Permission Role</label>
                <select value={editingUser.permissionRole} onChange={e => setEditingUser({...editingUser, permissionRole: e.target.value as UserProfile['permissionRole']})} className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                    <option value="student">student</option>
                    <option value="admin">admin</option>
                    <option value="super-admin">super-admin</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Display Title</label>
                <input type="text" value={editingUser.displayTitle} onChange={e => setEditingUser({...editingUser, displayTitle: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
             </div>
             <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Save Changes</button>
             </div>
          </form>
        </div>
      )}

      {/* Delete User Confirmation Modal (Admin and Super-Admin) */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl space-y-4">
             <h2 className="text-2xl font-bold text-red-600 mb-4">Confirm Deletion</h2>
             <p>Are you sure you want to delete <span className="font-bold">{deletingUser.name}</span> ({deletingUser.saeId || 'Pending ID'})?</p>
             <p className="text-sm text-gray-600">This action will remove their profile data. Their login account must be manually deleted from Firebase Authentication.</p>
             <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">To confirm, please type the user's SAE ID ({deletingUser.saeId || 'ID is Pending'}):</label>
                <input 
                  type="text" 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)} 
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  placeholder={deletingUser.saeId || 'Pending ID'}
                  disabled={!deletingUser.saeId} // Disable if ID is pending
                />
             </div>
             <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={() => { setDeletingUser(null); setDeleteConfirmText(''); }} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                <button 
                  type="button" 
                  onClick={handleDeleteUser} 
                  // Only enable delete if SAE ID exists and matches input
                  disabled={!deletingUser.saeId || deleteConfirmText !== deletingUser.saeId}
                  className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Delete User Data
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}

