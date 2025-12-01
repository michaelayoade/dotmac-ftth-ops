import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CustomerProviders } from "@/providers/CustomerProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Customer Portal",
  description: "Manage your internet service account",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <CustomerProviders>
          {children}
        </CustomerProviders>
      </body>
    </html>
  );
}
