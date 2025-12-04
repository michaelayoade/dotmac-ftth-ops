import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ResellerProviders } from "@/providers/ResellerProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Partner Portal",
  description: "Manage your partner account, referrals, and commissions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ResellerProviders>{children}</ResellerProviders>
      </body>
    </html>
  );
}
