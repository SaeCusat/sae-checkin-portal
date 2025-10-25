# SAE CUSAT Portal 🚗

A modern, Progressive Web App (PWA) built with Next.js for managing attendance and member check-ins at SAE CUSAT (Society of Automotive Engineers, Cochin University of Science and Technology).

[![Next.js](https://img.shields.io/badge/Next.js-15.4.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.0-orange)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC)](https://tailwindcss.com/)

## 🌟 Features

### Core Functionality

- **Real-time Check-in/Check-out System** - Track lab attendance with timestamp precision
- **Member Management** - Comprehensive user profiles with role-based access control
- **Admin Dashboard** - Powerful tools for user approval, management, and monitoring
- **Live Lab Status** - Real-time view of who's currently in the lab
- **Attendance History** - Detailed records with date filtering and export capabilities

### User Roles & Permissions

- **Students** - Access to personal profile, check-in/out, and attendance history
- **Faculty** - Similar access with department-specific profiles
- **Admin** - User approval, member management, and attendance monitoring
- **Super Admin** - Full system control including role modifications

### Technical Features

- ✅ **Progressive Web App (PWA)** - Install on any device, works offline
- ✅ **Responsive Design** - Optimized for mobile, tablet, and desktop
- ✅ **Real-time Updates** - Powered by Firebase Firestore listeners
- ✅ **Type-Safe** - Full TypeScript implementation
- ✅ **SEO Optimized** - Complete metadata and sitemap configuration
- ✅ **Secure Authentication** - Firebase Auth with email/password
- ✅ **Auto ID Generation** - Smart SAE ID assignment based on branch/year
- ✅ **Google Drive Integration** - Support for profile photo URLs

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn** or **pnpm**
- **Firebase Account** with a project set up
- **Git** for version control

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/SaeCusat/sae-checkin-portal.git
   cd sae-checkin-portal
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

   # Site Configuration
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Configure Firebase**

   Update `src/firebase.ts` if needed, then set up Firestore security rules (see [Firebase Setup](#firebase-setup) below).

5. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔥 Firebase Setup

### Firestore Collections Structure

```
users/
├── {userId}
│   ├── name: string
│   ├── saeId: string | null
│   ├── email: string
│   ├── userType: 'student' | 'faculty'
│   ├── branch: string
│   ├── semester: string (students only)
│   ├── team: string (students only)
│   ├── joinYear: string (students only)
│   ├── bloodGroup: string
│   ├── mobileNumber: string
│   ├── guardianNumber: string
│   ├── photoUrl: string
│   ├── permissionRole: 'student' | 'admin' | 'super-admin'
│   ├── displayTitle: string
│   ├── accountStatus: 'pending' | 'approved' | 'rejected'
│   └── isCheckedIn: boolean

attendance/
├── {attendanceId}
│   ├── userId: string
│   ├── userName: string
│   ├── saeId: string
│   ├── checkInTime: timestamp
│   ├── checkOutTime: timestamp | null
│   └── date: string (YYYY-MM-DD)

labStatus/
├── current
│   ├── isLabOpen: boolean
│   ├── currentlyCheckedIn: array
│   └── lastActivityTimestamp: timestamp

counters/
├── FACULTY
│   └── count: number
├── {BRANCHCODE}{YEAR}
│   └── count: number
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isApproved() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.accountStatus == 'approved';
    }

    function isAdmin() {
      return isApproved() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissionRole in ['admin', 'super-admin'];
    }

    function isSuperAdmin() {
      return isApproved() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissionRole == 'super-admin';
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
      allow create: if isSignedIn();
      allow update: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
      allow delete: if isAdmin();
    }

    // Attendance collection
    match /attendance/{attendanceId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow create: if isApproved();
      allow update: if isApproved();
      allow delete: if isAdmin();
    }

    // Lab status
    match /labStatus/{document=**} {
      allow read: if isApproved();
      allow write: if isApproved();
    }

    // Counters
    match /counters/{counterId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

### Firestore Indexes

Create these composite indexes in Firebase Console:

1. **Attendance by User and Date**

   - Collection: `attendance`
   - Fields: `userId` (Ascending), `date` (Ascending), `checkInTime` (Ascending)

2. **Attendance by Date**
   - Collection: `attendance`
   - Fields: `date` (Ascending), `checkInTime` (Ascending)

## 📁 Project Structure

```
sae-portal/
├── public/                    # Static files
│   ├── icons/                # PWA icons
│   ├── logo/                 # SAE logos
│   ├── manifest.json         # PWA manifest
│   ├── robots.txt           # SEO crawler rules
│   └── sw.js                # Service worker
├── src/
│   ├── app/                  # Next.js app directory
│   │   ├── admin/           # Admin dashboard
│   │   ├── landing/         # Check-in/out page
│   │   ├── profile/         # User profile page
│   │   ├── signup/          # Registration page
│   │   ├── layout.tsx       # Root layout with metadata
│   │   ├── page.tsx         # Home/Login page
│   │   ├── LoginPage.tsx    # Login component
│   │   ├── sitemap.ts       # Sitemap generation
│   │   ├── globals.css      # Global styles
│   │   ├── favicon.ico      # Favicon
│   │   ├── icon.png         # App icon
│   │   └── apple-icon.png   # iOS icon
│   └── firebase.ts          # Firebase configuration
├── .env.local               # Environment variables (not in repo)
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies
├── DEPLOYMENT_GUIDE.md      # Deployment instructions
└── README.md                # This file
```

## 🎨 Technology Stack

### Frontend

- **[Next.js 15.4.5](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

### Backend & Database

- **[Firebase Authentication](https://firebase.google.com/docs/auth)** - User authentication
- **[Cloud Firestore](https://firebase.google.com/docs/firestore)** - NoSQL database with real-time sync
- **[Firebase Hosting](https://firebase.google.com/docs/hosting)** - Optional hosting platform

### PWA & Performance

- **[next-pwa](https://github.com/shadowwalker/next-pwa)** - Progressive Web App support
- **[Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)** - Automatic image optimization

### Development Tools

- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting (recommended)

## 🔐 User Roles & Access Control

### Student

- View personal profile
- Edit limited profile fields (name, mobile, blood group, team, photo)
- Check in/out of lab
- View personal attendance history

### Faculty

- Same as student with department-specific fields
- Optional guardian/emergency contact

### Admin

- Approve/reject new member registrations
- View all users and attendance records
- Monitor live lab status
- View pending approvals
- Delete user accounts

### Super Admin

- All admin capabilities
- Modify user roles and permissions
- Edit user display titles
- Full system control

## 📱 PWA Features

- **Installable** - Add to home screen on mobile and desktop
- **Offline Support** - Service worker caching for offline functionality
- **App-like Experience** - Standalone display mode
- **Fast Loading** - Optimized assets and code splitting
- **Push Notifications Ready** - Infrastructure in place for future notifications

## 🎯 Key Workflows

### New Member Registration

1. User fills registration form (student or faculty)
2. Account created with `pending` status
3. Admin receives notification in dashboard
4. Admin reviews and approves/rejects
5. Upon approval, SAE ID auto-generated
6. User can now log in and access features

### SAE ID Generation Logic

**Students:**

```
Format: SAE{BRANCH}{YEAR}{SERIAL}
Example: SAEME2401
- ME = Mechanical Engineering
- 24 = Joining year (2024)
- 01 = First student from ME'24
```

**Faculty:**

```
Format: SAEFAC{SERIAL}
Example: SAEFAC001
- First faculty member = 001
```

### Check-in/Check-out Process

1. Approved user navigates to landing page
2. Clicks "Confirm Check In"
3. System creates attendance record
4. Lab status updated (isLabOpen = true)
5. User added to currentlyCheckedIn list
6. Later, user clicks "Confirm Check Out"
7. Checkout timestamp recorded
8. If last person, prompted to secure lab
9. Lab status updated if confirmed

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Useful commands
npm run build && npm run start  # Test production build locally
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**

   - Go to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy!

3. **Set Environment Variables in Vercel**

   - Add all variables from `.env.local`
   - Update `NEXT_PUBLIC_SITE_URL` to your Vercel domain

4. **Update Domain URLs**
   - Update `src/app/layout.tsx`
   - Update `src/app/sitemap.ts`
   - Update `public/robots.txt`

### Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## 🔍 SEO & Discoverability

- ✅ Comprehensive metadata (Open Graph, Twitter Cards)
- ✅ Auto-generated sitemap at `/sitemap.xml`
- ✅ robots.txt configured
- ✅ Favicon for all platforms
- ✅ Mobile-optimized
- ✅ Fast loading (Next.js optimizations)

## 🐛 Troubleshooting

### Firebase Connection Issues

- Verify `.env.local` values match Firebase Console
- Check Firebase project billing status
- Ensure Firestore is enabled in Firebase Console

### Build Errors

- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`

### PWA Not Installing

- Must be served over HTTPS (localhost is fine for testing)
- Check `manifest.json` is accessible
- Verify service worker registration in DevTools

### Favicon Not Showing

- Hard refresh browser (Ctrl+F5)
- Clear browser cache
- Verify files exist: `/favicon.ico`, `/icon.png`, `/apple-icon.png`

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Comment complex logic
- Maintain consistent formatting
- Run `npm run lint` before committing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

**SAE CUSAT Team**

- Organization: [Society of Automotive Engineers - CUSAT](https://github.com/SaeCusat)

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Firebase for backend infrastructure
- Vercel for hosting platform
- All SAE CUSAT members and contributors

## 📞 Support

For support, email saecusat@example.com or join our Slack channel.

## 🗺️ Roadmap

- [ ] Add export attendance to Excel/PDF
- [ ] Implement push notifications
- [ ] Add dark mode
- [ ] Multi-language support
- [ ] QR code check-in
- [ ] Analytics dashboard
- [ ] Event management system
- [ ] Team collaboration features

## 📊 Project Status

**Current Version:** 1.0.0
**Status:** Production Ready ✅

---

Made with ❤️ by SAE CUSAT Team
