export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'oklch(0.250 0.055 213)' }}
    >
      {children}
    </div>
  );
}
