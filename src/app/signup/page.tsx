'use client';

import { useState, FormEvent } from 'react';
import { auth, firestore } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import CustomDropdown from '../../components/CustomDropdown';

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
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Helper component for form inputs with labels
const InputField = ({ name, type, placeholder, required, onChange, value, className = '', label }: {
    name: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string | number;
    className?: string;
    label: string;
}) => (
    <div className={className}>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            id={name}
            name={name}
            type={type}
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={onChange}
            className="block w-full px-4 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-soft transition-all min-h-11"
        />
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
        teams: [] as string[],
        joinYear: new Date().getFullYear().toString(),
        department: BRANCH_OPTIONS[0],
        bloodGroup: BLOOD_GROUP_OPTIONS[0],
        mobileNumber: '',
        guardianNumber: '',
        photoUrl: '',
    });
    const [photoUrlValid, setPhotoUrlValid] = useState<boolean | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (e.target.name === 'photoUrl') {
            setPhotoUrlValid(null);
        }
    };

    // Toggle team in the teams array
    const toggleTeam = (teamName: string) => {
        const next = new Set(formData.teams);
        if (next.has(teamName)) next.delete(teamName);
        else next.add(teamName);
        const teamsArr = Array.from(next);
        setFormData({ ...formData, teams: teamsArr, team: teamsArr[0] || '' });
    };

    // Validate photo URL by attempting to load the image
    const validatePhotoUrl = (url: string) => {
        if (!url) { setPhotoUrlValid(null); return; }
        try {
            const img = document.createElement('img') as HTMLImageElement;
            img.onload = () => setPhotoUrlValid(true);
            img.onerror = () => setPhotoUrlValid(false);
            img.src = url;
            // If browser cached, onload/onerror may not fire; check naturalWidth after short delay
            setTimeout(() => {
                if (img.complete) {
                    if (img.naturalWidth && img.naturalHeight) setPhotoUrlValid(true);
                    else setPhotoUrlValid(false);
                }
            }, 300);
        } catch {
            setPhotoUrlValid(false);
        }
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userData: Record<string, any> = {
                name: formData.name,
                saeId: null,
                email: formData.email,
                userType: userType,
                club: 'SAE CUSAT',
                bloodGroup: formData.bloodGroup,
                mobileNumber: formData.mobileNumber,
                photoUrl: correctedPhotoUrl || '',
                permissionRole: userType === 'student' ? 'student' : 'admin',
                displayTitle: userType === 'student' ? 'Student' : 'Faculty',
                isCheckedIn: false,
                accountStatus: 'pending',
            };

            if (userType === 'student') {
                userData.branch = formData.branch;
                userData.semester = formData.semester;
                // store primary team (legacy) and full teams array
                userData.team = formData.team || (formData.teams && formData.teams[0]) || null;
                userData.teams = formData.teams && formData.teams.length > 0 ? formData.teams : null;
                // keep short form used by ID generation but also store full year for admin viewing
                userData.joinYear = formData.joinYear.slice(-2);
                userData.joinYearFull = formData.joinYear;
                userData.guardianNumber = formData.guardianNumber;
            } else {
                userData.branch = formData.department; // Store dept in branch field
                userData.semester = null;
                userData.team = null;
                userData.teams = null;
                userData.joinYear = null;
                userData.joinYearFull = null;
                userData.guardianNumber = formData.guardianNumber || null;
            }

            await setDoc(doc(firestore, 'users', user.uid), userData);
            setMessage("Registration successful! Your account is now awaiting approval from an admin. You will be able to log in once your account is approved.");
        } catch (err) {
            console.error("Sign up error:", err);
            if (err && typeof err === 'object' && 'code' in err && err.code === 'auth/email-already-in-use') {
                setError("This email address is already registered.");
            } else {
                setError((err as Error).message || "An error occurred during sign-up.");
            }
        }
        setIsSubmitting(false);
    };

    return (
        <main className="flex items-center justify-center min-h-screen p-4 py-12">
            {/* 
              RESPONSIVE CONTAINER
              - Mobile (320px+): Full width with minimal padding
              - Tablet (768px+): Max width 768px with more padding
              - Desktop (1024px+): Max width 896px (3xl)
            */}
            <div className="w-full max-w-3xl p-6 md:p-8 lg:p-10 space-y-6 md:space-y-8 card-solid-bg rounded-2xl shadow-elevated animate-fade-in">
                 <div className="flex justify-center mb-6">
                    <Image src="/logo/sae-logo.png" alt="SAE CUSAT Logo" width={100} height={50} />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">New Member Registration</h2>
                    <p className="mt-2 text-xs sm:text-sm text-gray-600">Your SAE ID will be assigned after admin approval.</p>
                </div>

                {message ? (
                    <div className="p-6 text-center text-green-800 bg-green-50 rounded-xl shadow-soft border border-green-200 animate-fade-in space-y-4">
                        <div className="inline-block p-3 bg-green-100 rounded-full">
                          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="font-semibold text-lg">{message}</p>
                        <Link href="/" className="inline-block mt-4 px-6 py-2.5 font-semibold text-white bg-linear-to-r from-indigo-600 to-indigo-700 rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift">
                            Return to Login Page
                        </Link>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
                        {/* User Type Tabs */}
                        <div className="flex justify-center gap-2 p-1 bg-gray-100 rounded-lg shadow-soft mb-6">
                            <button
                                type="button"
                                onClick={() => setUserType('student')}
                                className={`flex-1 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                                    userType === 'student'
                                    ? 'bg-white text-blue-900 shadow-soft'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <svg className="inline-block w-5 h-5 mr-2 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Student
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserType('faculty')}
                                className={`flex-1 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                                    userType === 'faculty'
                                    ? 'bg-white text-blue-900 shadow-soft'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <svg className="inline-block w-5 h-5 mr-2 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
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
                                    <CustomDropdown
                                        name="branch"
                                        label="Branch"
                                        value={formData.branch}
                                        options={BRANCH_OPTIONS}
                                        onChange={(value) => setFormData({ ...formData, branch: value })}
                                        required
                                    />
                                    <CustomDropdown
                                        name="semester"
                                        label="Semester"
                                        value={formData.semester}
                                        options={SEMESTER_OPTIONS.map(s => `S${s}`)}
                                        onChange={(value) => setFormData({ ...formData, semester: value })}
                                        required
                                        searchable={false}
                                        renderOption={(option) => `Semester ${option.replace('S', '')}`}
                                    />
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Teams <span className="text-xs text-gray-500">(select all that apply)</span></label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {TEAM_OPTIONS.map(t => (
                                                <label key={t} className="inline-flex items-center space-x-2 text-sm">
                                                    <input type="checkbox" checked={formData.teams.includes(t)} onChange={() => toggleTeam(t)} className="h-4 w-4" />
                                                    <span>{t}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <InputField name="joinYear" type="number" label="Year of Joining" placeholder="YYYY" required onChange={handleChange} value={formData.joinYear} />
                                    <InputField name="guardianNumber" type="tel" label="Guardian's Number" required onChange={handleChange} value={formData.guardianNumber} />
                                    <CustomDropdown
                                        name="bloodGroup"
                                        label="Blood Group"
                                        value={formData.bloodGroup}
                                        options={BLOOD_GROUP_OPTIONS}
                                        onChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                                        required
                                        searchable={false}
                                    />
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo URL <span className="text-red-500">*</span></label>
                                        <input id="photoUrl" name="photoUrl" type="url" placeholder="https://..." required value={formData.photoUrl} onChange={handleChange} onBlur={(e) => validatePhotoUrl(e.target.value)} className="block w-full px-4 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-soft transition-all min-h-11" />
                                        {photoUrlValid === false && (<p className="text-xs text-red-600 mt-1">Could not load image from this URL — please check the link or remove it.</p>)}
                                        {photoUrlValid === true && (<p className="text-xs text-green-600 mt-1">Photo URL looks good.</p>)}
                                    </div>
                                </>
                            )}

                            {userType === 'faculty' && (
                                <>
                                    <CustomDropdown
                                        name="department"
                                        label="Department"
                                        value={formData.department}
                                        options={BRANCH_OPTIONS}
                                        onChange={(value) => setFormData({ ...formData, department: value })}
                                        required
                                    />
                                    <InputField name="guardianNumber" type="tel" label="Emergency Contact (Optional)" onChange={handleChange} value={formData.guardianNumber} />
                                    <CustomDropdown
                                        name="bloodGroup"
                                        label="Blood Group (Optional)"
                                        value={formData.bloodGroup}
                                        options={BLOOD_GROUP_OPTIONS}
                                        onChange={(value) => setFormData({ ...formData, bloodGroup: value })}
                                        searchable={false}
                                    />
                                    <InputField name="photoUrl" type="url" label="Photo URL (Optional)" placeholder="https://..." onChange={handleChange} value={formData.photoUrl} className="md:col-span-2" />
                                </>
                            )}
                        </div>

                        {error && (
                          <div className="p-4 text-sm text-center text-red-800 bg-red-50 rounded-lg border border-red-200 animate-fade-in">
                            <svg className="inline-block w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                          </div>
                        )}

                        <div className="pt-4">
                            <button 
                              type="submit" 
                              disabled={isSubmitting} 
                              className="w-full py-3 px-4 font-semibold text-white bg-linear-to-r from-blue-600 to-indigo-700 rounded-lg shadow-soft hover:shadow-elevated transition-all duration-200 hover-lift disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-soft disabled:transform-none"
                            >
                                {isSubmitting ? (
                                  <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Registering...
                                  </span>
                                ) : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                )}
                 <div className="text-sm text-center pt-4 border-t mt-6 border-gray-200">
                    <p className="text-gray-600">
                        Already have an account?{' '}
                        <Link href="/" className="font-semibold text-blue-800 hover:text-blue-900 transition-colors">
                           Sign In Here
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
