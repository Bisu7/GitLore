import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitLore — Your codebase's institutional memory",
  description: "GitLore indexes your Git history, pull requests, and commits into a searchable knowledge base. Understand why every line of code exists.",
};

import UpgradeModal from "./components/UpgradeModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {children}
        <UpgradeModal />
      </body>
    </html>
  );
}
