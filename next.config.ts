/** @type {import('next').NextConfig} */

// Import the PWA plugin
const withPWA = require('next-pwa')({ // Corrected require statement
  dest: 'public', // Destination directory for PWA files
  register: true, // Register the service worker
  skipWaiting: true, // Install new service worker immediately
  disable: process.env.NODE_ENV === 'development', // Disable PWA in dev mode
});

const nextConfig = {
  // Your existing Next.js config (like images) goes here
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // For Google Drive images
        port: '',
        pathname: '/**',
      },
      // --- ADD THIS OBJECT ---
      {
        protocol: 'https',
        hostname: 'placehold.co', // Allow images from placehold.co
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Ensure reactStrictMode is enabled (usually default)
  reactStrictMode: true,
};

// Wrap your config with the PWA plugin
module.exports = withPWA(nextConfig);

