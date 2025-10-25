/** @type {import('next').NextConfig} */

// Import the PWA plugin using the correct package name
const withPWA = require('next-pwa')({ // Corrected require statement
  dest: 'public', // Destination directory for PWA files
  register: true, // Register the service worker
  skipWaiting: true, // Install new service worker immediately
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development mode for faster builds
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
    ],
  },
};

// Wrap your config with the PWA plugin
module.exports = withPWA(nextConfig);

