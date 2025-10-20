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

    const labStatusUnsub = onSnapshot(doc(firestore, 'labStatus', 'current'), (doc) => {
      const data = doc.data();
      setLabIsOpen(data?.isLabOpen || false);
      setLiveUsers(data?.currentlyCheckedIn || []);
    });

    const pendingQuery = query(collection(firestore, 'users'), where('accountStatus', '==', 'pending'));
    const pendingUnsub = onSnapshot(pendingQuery, (snapshot) => {
      const pUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setPendingUsers(pUsers);
    });
    
    let allUsersUnsub = () => {};
    if (userProfile?.permissionRole === 'super-admin') {
      const allUsersQuery = query(collection(firestore, 'users'), orderBy('name'));
      allUsersUnsub = onSnapshot(allUsersQuery, (snapshot) => {
        const aUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(aUsers);
      });
    }

    return () => {
      labStatusUnsub();
      pendingUnsub();
      allUsersUnsub();
    };
  }, [user, userProfile]);

  useEffect(() => {
    if (!user) return;
    // CORRECTED: More robust query for fetching attendance history
    const attendanceQuery = query(
      collection(firestore, 'attendance'),
      where('date', '==', historyDate),
      orderBy('checkInTime', 'asc') // Fetch in chronological order
    );
    const historyUnsub = onSnapshot(attendanceQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setHistory(records);
    }, (error) => {
        console.error("Error fetching attendance history: ", error);
        // This is where you might see a permissions error or an index error
    });
    return () => historyUnsub();
  }, [user, historyDate]);
  
  const handleApprove = async (pendingUser: UserProfile) => {
    if (!window.confirm(`Are you sure you want to approve ${pendingUser.name}? An SAE ID will be generated.`)) return;
    
    try {
      const branchCode = pendingUser.branch.toUpperCase();
      const year = pendingUser.joinYear;
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
        // Note: This does not delete the Firebase Auth user. That must be done from the console.
        alert('User rejected and data deleted. Their login account must be deleted from the Authentication tab manually for now.');
    } catch (error) {
        console.error("Rejection error:", error);
        alert('Error rejecting user.');
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
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {userProfile?.name}</p>
            </div>
            <button onClick={() => router.push('/profile')} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">My Profile</button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
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
                {liveUsers.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-gray-700">
                    {liveUsers.map(liveUser => <li key={liveUser.id}>{liveUser.name}</li>)}
                  </ul>
                ) : (
                  <p className="mt-4 text-gray-500">The lab is currently empty.</p>
                )}
              </div>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Attendance History</h3>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="border rounded-md px-2 py-1"/>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">SAE ID</th>
                      <th className="p-3">Check In</th>
                      <th className="p-3">Check Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(rec => (
                      <tr key={rec.id} className="border-b">
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

          <div className="bg-white p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Approvals ({pendingUsers.length})</h3>
             {pendingUsers.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead><tr className="bg-gray-100"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Branch</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>
                    {pendingUsers.map(pUser => (
                      <tr key={pUser.id} className="border-b">
                        <td className="p-3">{pUser.name}</td>
                        <td className="p-3">{pUser.email}</td>
                        <td className="p-3">{pUser.branch}</td>
                        <td className="p-3 flex space-x-2">
                          <button onClick={() => setViewingUser(pUser)} className="text-blue-600 hover:underline">View</button>
                          <button onClick={() => handleApprove(pUser)} className="text-green-600 hover:underline">Approve</button>
                          <button onClick={() => handleReject(pUser.id)} className="text-red-600 hover:underline">Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             ) : <p className="text-gray-500">No new members awaiting approval.</p>}
          </div>

          {userProfile?.permissionRole === 'super-admin' && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">User Management</h3>
              <table className="w-full text-sm text-left">
                <thead><tr className="bg-gray-100"><th className="p-3">Name</th><th className="p-3">SAE ID</th><th className="p-3">Role</th><th className="p-3">Title</th><th className="p-3">Actions</th></tr></thead>
                <tbody>
                  {allUsers.map(aUser => (
                    <tr key={aUser.id} className="border-b">
                      <td className="p-3">{aUser.name}</td>
                      <td className="p-3">{aUser.saeId || 'Pending'}</td>
                      <td className="p-3">{aUser.permissionRole}</td>
                      <td className="p-3">{aUser.displayTitle}</td>
                      <td className="p-3 flex space-x-2">
                        <button onClick={() => setViewingUser(aUser)} className="text-blue-600 hover:underline">View</button>
                        <button onClick={() => setEditingUser(aUser)} className="text-indigo-600 hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-xl relative">
            <button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
            <h2 className="text-2xl font-bold mb-4">{viewingUser.name}'s Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
                <p><strong>SAE ID:</strong> {viewingUser.saeId || 'Pending'}</p>
                <p><strong>Email:</strong> {viewingUser.email}</p>
                <p><strong>Branch:</strong> {viewingUser.branch}</p>
                <p><strong>Semester:</strong> {viewingUser.semester}</p>
                <p><strong>Mobile:</strong> {viewingUser.mobileNumber}</p>
                <p><strong>Guardian:</strong> {viewingUser.guardianNumber}</p>
                <p><strong>Blood Group:</strong> {viewingUser.bloodGroup}</p>
                <p><strong>Role:</strong> {viewingUser.permissionRole}</p>
                <p><strong>Title:</strong> {viewingUser.displayTitle}</p>
                <p><strong>Status:</strong> {viewingUser.accountStatus}</p>
            </div>
          </div>
        </div>
      )}
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
    </>
  );
}

