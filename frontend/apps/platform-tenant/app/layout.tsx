import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TenantProviders } from "@/providers/TenantProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tenant Portal",
  description: "Manage your ISP subscription, billing, and team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <TenantProviders>{children}</TenantProviders>
      </body>
    </html>
  );
}
