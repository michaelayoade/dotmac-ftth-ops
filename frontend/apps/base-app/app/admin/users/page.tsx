"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Shield, UserMinus, UserPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useUsers,
  useDisableUser,
  useEnableUser,
  useDeleteUser,
  getUserStatus,
  getUserPrimaryRole,
  formatLastSeen,
  getUserDisplayName,
  type User,
} from "@/hooks/useUsers";

type UserStatus = "Active" | "Invited" | "Suspended";

const ROLE_FILTERS = [
  "All roles",
  "Admin",
  "User",
  "Guest",
  "Platform Admin",
  "Superuser",
] as const;
const STATUS_COLORS: Record<UserStatus, string> = {
  Active: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  Invited: "bg-blue-500/10 text-blue-200 border border-blue-500/20",
  Suspended: "bg-red-500/10 text-red-200 border border-red-500/20",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("All roles");

  // Fetch users from API
  const { data: users = [], isLoading, error } = useUsers();

  // Mutations
  const disableUser = useDisableUser();
  const enableUser = useEnableUser();
  const deleteUser = useDeleteUser();

  // Filter users
  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        (user.full_name?.toLowerCase() || "").includes(search.toLowerCase());

      const userRole = getUserPrimaryRole(user);
      const matchesRole =
        roleFilter === "All roles" || userRole.toLowerCase().includes(roleFilter.toLowerCase());

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const handleToggleUserStatus = async (user: User) => {
    if (user.is_active) {
      await disableUser.mutateAsync(user.id);
    } else {
      await enableUser.mutateAsync(user.id);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      await deleteUser.mutateAsync(userId);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              User management
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Administrators & elevated users
            </h1>
            <p className="text-sm text-muted-foreground">
              Invite new platform administrators, adjust roles and review account security status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled className="gap-2">
              <UserMinus className="h-4 w-4" />
              Disable selected
            </Button>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite admin
            </Button>
          </div>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load users: {error.message}. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, username or email"
                className="border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                disabled={isLoading}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as (typeof ROLE_FILTERS)[number])
              }
              className="h-10 w-full max-w-xs rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              disabled={isLoading}
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <CardDescription>
            {isLoading ? (
              "Loading users..."
            ) : (
              <>
                There are {filtered.length} of {users.length} users displayed.{" "}
                <Link href="/admin/settings" className="text-primary underline underline-offset-4">
                  Configure password & session policies
                </Link>
                .
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
            </div>
          )}

          {/* Table */}
          {!isLoading && (
            <Table data-testid="user-list">
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Email
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    MFA
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last seen
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const status = getUserStatus(user);
                  const role = getUserPrimaryRole(user);
                  const displayName = getUserDisplayName(user);
                  const lastSeen = formatLastSeen(user.last_login);

                  return (
                    <TableRow key={user.id} className="border-border/20">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{displayName}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            @{user.username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/60 text-foreground">
                          {role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}
                        >
                          {status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.mfa_enabled ? (
                          <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
                            <Shield className="h-4 w-4" />
                            Enabled
                          </span>
                        ) : (
                          <span className="text-sm text-red-300">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lastSeen}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-primary"
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={disableUser.isPending || enableUser.isPending}
                          >
                            {user.is_active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteUser.isPending}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {users.length === 0
                        ? "No users found. Register your first user to get started."
                        : "No users match the current filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
