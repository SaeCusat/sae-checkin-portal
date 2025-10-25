'use client';

import { useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image'; // Import Image for logo

// Helper function to convert Google Drive links
function convertGoogleDriveUrl(url: string): string {
    if (!url || !url.includes('drive.google.com')) return url;
    const match = url.match(/id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
}

// Constants for dropdowns
const BRANCH_OPTIONS = ["ME", "EEE", "ECE", "SF", "CS", "IT", "CE"]; // Also used for Department
const SEMESTER_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const TEAM_OPTIONS = [
    "TARUSA", "YETI", "ASTRON ENDURANCE", "MARUTSAKHA",
    "HERMES", "ELEKTRA", "STORM RACING", "BEHEMOTH", "AROHA"
];

// Helper component for form inputs with labels
const InputField = ({ name, type, placeholder, required, onChange, value, className = '', label, options }: {
    name: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    value: string | number;
    className?: string;
    label: string;
    options?: string[];
}) => (
    <div className={className}>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {type === 'select' && options ? (
            <select
                id={name}
                name={name}
                required={required}
                value={value}
                onChange={onChange}
                className="input-style"
            >
                {name === 'department' && <option value="" disabled>Select Department</option>}
                 {name === 'semester' && options.map(opt => <option key={opt} value={`S${opt}`}>Semester {opt}</option>)}
                 {name !== 'semester' && options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : (
            <input
                id={name}
                name={name}
                type={type}
                placeholder={placeholder}
                required={required}
                value={value}
                onChange={onChange}
                className="input-style"
            />
        )}
    </div>
);


export default function SignUpPage() {
    const [userType, setUserType] = useState<'student' | 'faculty'>('student');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        branch: BRANCH_OPTIONS[0],
        semester: 'S1',
        team: TEAM_OPTIONS[0],
        joinYear: new Date().getFullYear().toString(),
        department: BRANCH_OPTIONS[0],
        bloodGroup: '',
        mobileNumber: '',
        guardianNumber: '',
        photoUrl: '',
    });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignUp = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }
        setIsSubmitting(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            const correctedPhotoUrl = convertGoogleDriveUrl(formData.photoUrl);

            const userData: any = {
                name: formData.name,
                saeId: null,
                email: formData.email,
                userType: userType,
                club: 'SAE CUSAT',
                bloodGroup: formData.bloodGroup,
                mobileNumber: formData.mobileNumber,
                photoUrl: correctedPhotoUrl || `https://i.pravatar.cc/150?u=${user.uid}`,
                permissionRole: 'student',
                displayTitle: userType === 'student' ? 'Student' : 'Faculty',
                isCheckedIn: false,
                accountStatus: 'pending',
            };

            if (userType === 'student') {
                userData.branch = formData.branch;
                userData.semester = formData.semester;
                userData.team = formData.team;
                userData.joinYear = formData.joinYear.slice(-2);
                userData.guardianNumber = formData.guardianNumber;
            } else {
                userData.branch = formData.department; // Store dept in branch field
                userData.semester = null;
                userData.team = null;
                userData.joinYear = null;
                userData.guardianNumber = formData.guardianNumber || null;
            }

            await setDoc(doc(firestore, 'users', user.uid), userData);
            setMessage("Registration successful! Your account is now awaiting approval from an admin. You will be able to log in once your account is approved.");
        } catch (err: any) {
            console.error("Sign up error:", err);
            setError(err.code === 'auth/email-already-in-use' ? "This email address is already registered." : (err.message || "An error occurred during sign-up."));
        }
        setIsSubmitting(false);
    };

    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 via-blue-50 to-gray-100 p-4 py-12">
            <div className="w-full max-w-3xl p-8 md:p-10 space-y-8 bg-white rounded-xl shadow-lg">
                 <div className="flex justify-center mb-6">
                    <Image src="/logo/sae-logo.png" alt="SAE CUSAT Logo" width={100} height={50} />
                </div>
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900">New Member Registration</h2>
                    <p className="mt-2 text-sm text-gray-600">Your SAE ID will be assigned after admin approval.</p>
                </div>

                {message ? (
                    <div className="p-4 text-center text-green-800 bg-green-100 rounded-md shadow-sm">
                        <p className="font-semibold">{message}</p>
                        <Link href="/" className="mt-4 inline-block font-bold text-indigo-600 hover:text-indigo-500">
                            Return to Login Page
                        </Link>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
                        {/* User Type Tabs */}
                        <div className="flex justify-center border-b border-gray-200 mb-6">
                            {/* Styling adjusted for tabs */}
                            <button
                                type="button"
                                onClick={() => setUserType('student')}
                                className={`px-5 py-2 text-sm font-semibold rounded-t-md transition-colors duration-150 ease-in-out ${
                                    userType === 'student'
                                    ? 'bg-indigo-50 border-b-2 border-indigo-600 text-indigo-700'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserType('faculty')}
                                className={`px-5 py-2 text-sm font-semibold rounded-t-md transition-colors duration-150 ease-in-out ${
                                    userType === 'faculty'
                                    ? 'bg-indigo-50 border-b-2 border-indigo-600 text-indigo-700'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                Faculty
                            </button>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {/* --- UPDATED: Full Name spans both columns --- */}
                            <InputField name="name" type="text" label="Full Name" required onChange={handleChange} value={formData.name} className="md:col-span-2" />
                            <InputField name="email" type="email" label="Email Address" required onChange={handleChange} value={formData.email} className="md:col-span-2" />
                            <InputField name="password" type="password" label="Password (min. 6 characters)" required onChange={handleChange} value={formData.password} />
                            <InputField name="confirmPassword" type="password" label="Confirm Password" required onChange={handleChange} value={formData.confirmPassword} />
                            <InputField name="mobileNumber" type="tel" label="Mobile Number" required onChange={handleChange} value={formData.mobileNumber} />

                            {/* Conditional Fields */}
                            {userType === 'student' && (
                                <>
                                    <InputField name="branch" type="select" label="Branch" required onChange={handleChange} value={formData.branch} options={BRANCH_OPTIONS} />
                                    <InputField name="semester" type="select" label="Semester" required onChange={handleChange} value={formData.semester} options={SEMESTER_OPTIONS} />
                                    <InputField name="team" type="select" label="Team" required onChange={handleChange} value={formData.team} options={TEAM_OPTIONS} />
                                    <InputField name="joinYear" type="number" label="Year of Joining" placeholder="YYYY" required onChange={handleChange} value={formData.joinYear} />
                                    <InputField name="guardianNumber" type="tel" label="Guardian's Number" required onChange={handleChange} value={formData.guardianNumber} />
                                    <InputField name="bloodGroup" type="text" label="Blood Group" placeholder="e.g., O+" required onChange={handleChange} value={formData.bloodGroup} />
                                </>
                            )}

                            {userType === 'faculty' && (
                                <>
                                    <InputField name="department" type="select" label="Department" required onChange={handleChange} value={formData.department} options={BRANCH_OPTIONS} />
                                    <InputField name="guardianNumber" type="tel" label="Emergency Contact (Optional)" onChange={handleChange} value={formData.guardianNumber} />
                                    <InputField name="bloodGroup" type="text" label="Blood Group (Optional)" placeholder="e.g., O+" onChange={handleChange} value={formData.bloodGroup} />
                                </>
                            )}
                            <InputField name="photoUrl" type="url" label="Photo URL (Optional)" placeholder="https://..." onChange={handleChange} value={formData.photoUrl} className="md:col-span-2" />
                        </div>

                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                        <div className="pt-4">
                            <button type="submit" disabled={isSubmitting} className="w-full py-3 px-4 font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:shadow-none">
                                {isSubmitting ? 'Registering...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                )}
                 <div className="text-sm text-center pt-4 border-t mt-6">
                    <p className="text-gray-600">
                        Already have an account?{' '}
                        <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
                           Sign In Here
                        </Link>
                    </p>
                </div>
            </div>
            {/* Style definitions moved outside main component */}
            <style jsx global>{`
              .input-style {
                display: block; width: 100%; height: 2.75rem; /* 44px */
                padding: 0.5rem 0.75rem; /* 8px 12px */
                font-size: 0.875rem; /* 14px */ line-height: 1.25rem; /* 20px */
                border: 1px solid #D1D5DB; /* border-gray-300 */
                border-radius: 0.375rem; /* rounded-md */
                appearance: none; /* remove default styling */
                background-color: #fff;
                box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
              }
              .input-style:focus {
                outline: 2px solid transparent; outline-offset: 2px;
                border-color: #4F46E5; /* focus:border-indigo-500 */
                box-shadow: 0 0 0 3px rgb(79 70 229 / 0.2); /* Adjusted focus ring */
              }
              /* Style selects slightly differently */
              select.input-style {
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 0.5rem center;
                background-repeat: no-repeat;
                background-size: 1.5em 1.5em;
                padding-right: 2.5rem;
              }
            `}</style>
        </main>
    );
}

