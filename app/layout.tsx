import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NeevCloud SEO Engine",
  description: "Content intelligence platform for NeevCloud — keyword clustering, brief generation, quality gate, and site audit. Built for the GTM Engineer case study.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent-green)] transition-colors">
              <span className="text-[var(--accent-green)]">▸</span>
              <span>NeevCloud SEO Engine</span>
            </Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block"></span>
              live
            </span>
            <a
              href="https://github.com/robertlangdonn/neev-cloud-gtm"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--foreground)] transition-colors"
            >
              github
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] px-6 py-6 text-xs text-[var(--muted-foreground)]">
          <div className="max-w-5xl mx-auto flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-3">
              <span>Built by</span>
              <a href="https://prasadkhake.com" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)] hover:text-[var(--accent-green)] transition-colors font-medium">Prasad Khake</a>
              <span className="text-[var(--border)]">·</span>
              <a href="mailto:prasadkhake@gmail.com" className="hover:text-[var(--foreground)] transition-colors">prasadkhake@gmail.com</a>
              <span className="text-[var(--border)]">·</span>
              <a href="https://github.com/robertlangdonn/neev-cloud-gtm" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">github</a>
            </div>
            <div className="text-[var(--border)]">GTM Engineer case study · the application is the build.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}

