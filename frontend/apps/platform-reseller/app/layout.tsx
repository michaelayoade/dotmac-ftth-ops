import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PartnerProviders } from "@/providers/PartnerProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Partner Portal | DotMac Platform",
  description: "Channel partner portal for managing ISP tenant referrals and commissions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PartnerProviders>{children}</PartnerProviders>
      </body>
    </html>
  );
}
