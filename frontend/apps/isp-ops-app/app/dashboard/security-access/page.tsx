"use client";

import Link from "next/link";
import {
  Shield,
  Key,
  Lock,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";

export default function SecurityOverviewPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-8 w-8 text-sky-400" />
            Security & Access Control
          </h1>
          <p className="text-slate-400 mt-1">
            Manage security settings, API access, and user permissions
          </p>
        </div>

        {/* Security Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <Key className="h-8 w-8 text-sky-400" />
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">12</h3>
            <p className="text-slate-400 text-sm">Active API Keys</p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <Lock className="h-8 w-8 text-purple-400" />
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">8</h3>
            <p className="text-slate-400 text-sm">Stored Secrets</p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-green-400" />
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">24</h3>
            <p className="text-slate-400 text-sm">Active Users</p>
          </div>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-amber-400" />
              <Activity className="h-5 w-5 text-sky-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">1,247</h3>
            <p className="text-slate-400 text-sm">Audit Events Today</p>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/dashboard/security-access/api-keys"
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-sky-500 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-sky-500/20 rounded-lg group-hover:bg-sky-500/30 transition-colors">
                <Key className="h-6 w-6 text-sky-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">API Keys</h3>
                <p className="text-slate-400 text-sm">Manage integration keys</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Create and manage API keys for external integrations and services with granular
              scope-based permissions.
            </p>
          </Link>

          <Link
            href="/dashboard/security-access/secrets"
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-purple-500 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                <Lock className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Secrets Management</h3>
                <p className="text-slate-400 text-sm">Secure credential storage</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Securely store and manage sensitive credentials, tokens, and configuration secrets
              using Vault integration.
            </p>
          </Link>

          <Link
            href="/dashboard/security-access/roles"
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-green-500 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Roles & Permissions</h3>
                <p className="text-slate-400 text-sm">Access control management</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Define roles and assign granular permissions to control access to platform features
              and resources.
            </p>
          </Link>

          <Link
            href="/dashboard/security-access/users"
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-amber-500 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
                <Users className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">User Management</h3>
                <p className="text-slate-400 text-sm">Manage user accounts</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Add, modify, and deactivate user accounts. Assign roles and manage user permissions
              across the platform.
            </p>
          </Link>

          <Link
            href="/dashboard/audit"
            className="bg-slate-900 rounded-lg p-6 border border-slate-800 hover:border-blue-500 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Audit Logs</h3>
                <p className="text-slate-400 text-sm">Security event tracking</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Review comprehensive audit logs of all security-related events, access attempts, and
              system changes.
            </p>
          </Link>

          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <Activity className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Security Health</h3>
                <p className="text-slate-400 text-sm">System security status</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">2FA Enabled</span>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">SSL/TLS Active</span>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Vault Connected</span>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="mt-8 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Recent Security Events
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-white text-sm">New API key created</p>
                  <p className="text-slate-400 text-xs">Production Integration Key</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />2 hours ago
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-500/20 rounded">
                  <Users className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <p className="text-white text-sm">New user account created</p>
                  <p className="text-slate-400 text-xs">john.doe@example.com</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />5 hours ago
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded">
                  <Lock className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-white text-sm">Secret updated</p>
                  <p className="text-slate-400 text-xs">payment_gateway_api_key</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />1 day ago
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/audit"
            className="mt-4 text-sky-400 hover:text-sky-300 text-sm inline-flex items-center gap-1"
          >
            View all audit logs
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
