import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google'; // Use the Inter font
import './globals.css';

const inter = Inter({ subsets: ['latin'] }); // Initialize Inter

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sae-cusat-portal.vercel.app'),
  title: 'SAE CUSAT Portal',
  description: 'Attendance and member portal for SAE CUSAT',
  manifest: '/manifest.json',
  
  // Application metadata for PWA
  applicationName: 'SAE CUSAT Portal',
  keywords: ['SAE', 'CUSAT', 'Student Portal', 'Check-in', 'Attendance', 'SAE India'],
  authors: [{ name: 'SAE CUSAT' }],
  creator: 'SAE CUSAT',
  publisher: 'SAE CUSAT',
  
  // Format detection
  formatDetection: {
    telephone: false,
  },
  
  // Apple Web App metadata
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SAE CUSAT',
  },
  
  // Open Graph metadata for social sharing and Google
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sae-cusat-portal.vercel.app', // Update with your actual domain
    title: 'SAE CUSAT Portal',
    description: 'Attendance and member portal for SAE CUSAT',
    siteName: 'SAE CUSAT Portal',
    images: [
      {
        url: '/icon.png',
        width: 512,
        height: 512,
        alt: 'SAE CUSAT Logo',
      },
    ],
  },
  
  // Twitter Card metadata
  twitter: {
    card: 'summary',
    title: 'SAE CUSAT Portal',
    description: 'Attendance and member portal for SAE CUSAT',
    images: ['/icon.png'],
  },
  
  // Icons metadata - ensures Google finds the favicon
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  
  // Additional metadata for better indexing
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Explicit favicon links for maximum compatibility */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      {/* Apply the Inter font class to the body */}
      <body className={inter.className}>
        {children}
        {/* If you decide to add Toast notifications later, the <Toaster /> component goes here */}
      </body>
    </html>
  );
}


