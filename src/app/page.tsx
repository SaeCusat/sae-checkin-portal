// src/app/page.tsx
import LoginPage from "./LoginPage"; // Import the component

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <LoginPage /> {/* Display the login form */}
    </main>
  );
}