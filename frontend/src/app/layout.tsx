import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Hope",
  description: "Value Engine Analysis App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col`}
      >
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 shadow-md shadow-emerald-500/20 flex items-center justify-center font-bold text-white">
                VE
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">Value Engine</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="/" className="hover:text-emerald-600 transition-colors">Dashboard</a>
              <a href="/screener" className="hover:text-emerald-600 transition-colors">Screener</a>
              <a href="/portfolio" className="hover:text-emerald-600 transition-colors">Portfolio</a>
              <a href="/analysis" className="hover:text-emerald-600 transition-colors">Analysis</a>
            </nav>
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
