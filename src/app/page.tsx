// src/app/page.tsx
import LoginPage from "./LoginPage"; // Import the component

export default function Home() {
  return (
    // This provides the gray background and centers everything
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
      <LoginPage /> {/* Display the login form */}
    </main>
  );
}