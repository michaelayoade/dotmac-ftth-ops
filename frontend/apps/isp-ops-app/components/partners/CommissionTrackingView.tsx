"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

interface Commission {
  id: string;
  partner_id: string;
  customer_id: string;
  invoice_id?: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  status: "pending" | "approved" | "paid" | "disputed" | "cancelled";
  event_date: string;
  payment_date?: string;
  notes?: string;
  created_at: string;
}

interface CommissionListResponse {
  commissions: Commission[];
  total: number;
  page: number;
  page_size: number;
}

interface CommissionTrackingViewProps {
  partnerId: string;
}

async function fetchCommissions(
  partnerId: string,
  status?: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<CommissionListResponse> {
  const params = new URLSearchParams({
    partner_id: partnerId,
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  const response = await fetch(
    `${API_BASE}/api/isp/v1/admin/partners/commissions?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch commissions");
  }

  return response.json();
}

export default function CommissionTrackingView({ partnerId }: CommissionTrackingViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-commissions", partnerId, statusFilter, page],
    queryFn: () => fetchCommissions(partnerId, statusFilter, page),
  });

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading commissions...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-400">Failed to load commissions</div>
        <div className="text-sm text-slate-500 mt-2">{(error as Error).message}</div>
      </div>
    );
  }

  const commissions = data?.commissions || [];
  const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const pendingCommissions = commissions
    .filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + c.commission_amount, 0);
  const paidCommissions = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const STATUS_COLORS = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    disputed: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Total Commissions</div>
          <div className="text-2xl font-bold text-white">${totalCommissions.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">{commissions.length} events</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">
            ${pendingCommissions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Awaiting payment</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Paid</div>
          <div className="text-2xl font-bold text-green-400">
            ${paidCommissions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Completed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm text-slate-400 mb-2">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-64 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Commissions Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {commissions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No commissions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Payment Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">
                      {new Date(commission.event_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {commission.customer_id.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      ${commission.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {(commission.commission_rate * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      ${commission.commission_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded border ${
                          STATUS_COLORS[commission.status]
                        }`}
                      >
                        {commission.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {commission.payment_date
                        ? new Date(commission.payment_date).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-400">
            Showing {(page - 1) * data.page_size + 1} to{" "}
            {Math.min(page * data.page_size, data.total)} of {data.total} commissions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * data.page_size >= data.total}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
