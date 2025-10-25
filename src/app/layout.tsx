import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Use the Inter font
import './globals.css';

const inter = Inter({ subsets: ['latin'] }); // Initialize Inter

export const metadata: Metadata = {
  title: 'SAE CUSAT Portal',
  description: 'Attendance and member portal for SAE CUSAT',
  manifest: '/manifest.json' // Link the manifest file here
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Apply the Inter font class to the body */}
      <body className={inter.className}>
        {children}
        {/* If you decide to add Toast notifications later, the <Toaster /> component goes here */}
      </body>
    </html>
  );
}

