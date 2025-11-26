"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import {
  Home,
  CreditCard,
  Headphones,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  User,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CustomerAuthProvider,
  useCustomerAuth,
  CustomerProtectedRoute,
} from "@/lib/auth/CustomerAuthContext";
import { PortalBadge } from "@dotmac/ui";

const navigation = [
  { name: "Dashboard", href: "/customer-portal", icon: Home },
  { name: "My Service", href: "/customer-portal/service", icon: Wifi },
  { name: "Billing", href: "/customer-portal/billing", icon: CreditCard },
  { name: "Usage", href: "/customer-portal/usage", icon: BarChart3 },
  { name: "Support", href: "/customer-portal/support", icon: Headphones },
  { name: "Settings", href: "/customer-portal/settings", icon: Settings },
];

function CustomerPortalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useCustomerAuth();

  // Don't show layout on login page
  if (pathname === "/customer-portal/login") {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/customer-portal" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Wifi className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg hidden sm:inline-block">My Account</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/customer-portal" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarImage src="" alt={`${user.first_name} ${user.last_name}`} />
                  <AvatarFallback>
                    {(user.first_name?.[0] || user["email"]?.[0] || "U").toUpperCase()}
                    {(user.last_name?.[0] || user["email"]?.[1] || "").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">
                    Account: {user.account_number}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/customer-portal/settings">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b bg-background">
          <nav className="container px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/customer-portal" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6">
        {/* Portal Badge - Shows which portal user is in */}
        <div className="mb-4 flex items-center justify-between">
          <PortalBadge className="" showIcon shortName size="sm" />
        </div>
        <CustomerProtectedRoute>{children}</CustomerProtectedRoute>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div>© 2025 Your ISP Company. All rights reserved.</div>
            <div className="flex gap-6">
              <Link href="/customer-portal/help" className="hover:text-primary">
                Help Center
              </Link>
              <Link href="/customer-portal/terms" className="hover:text-primary">
                Terms of Service
              </Link>
              <Link href="/customer-portal/privacy" className="hover:text-primary">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CustomerPortalContent>{children}</CustomerPortalContent>
    </CustomerAuthProvider>
  );
}
