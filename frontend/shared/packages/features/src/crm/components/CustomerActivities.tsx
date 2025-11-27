import {
  Clock,
  Plus,
  Activity,
  User,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Settings,
  LogIn,
  MessageSquare,
  Tag,
  Loader2,
} from "lucide-react";
import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface CustomerActivity {
  id: string;
  customer_id: string;
  activity_type: string;
  title: string;
  description: string | undefined;
  metadata: Record<string, any> | undefined;
  created_at: string;
}

export interface ActivityLogger {
  error: (message: string, error: Error) => void;
}

export interface CustomerActivitiesHook {
  activities: CustomerActivity[];
  loading: boolean;
  error: string | undefined;
  addActivity: (
    activity: Omit<CustomerActivity, "id" | "customer_id" | "created_at">,
  ) => Promise<void>;
}

export interface CustomerActivitiesProps {
  customerId: string;
  useCustomerActivities: (customerId: string) => CustomerActivitiesHook;
  logger: ActivityLogger;
}

// ============================================================================
// Helper Components
// ============================================================================

interface ActivityIconProps {
  type: string;
}

function ActivityIcon({ type }: ActivityIconProps) {
  const iconMap: Record<string, React.ElementType> = {
    created: User,
    updated: Settings,
    status_changed: Activity,
    note_added: MessageSquare,
    tag_added: Tag,
    tag_removed: Tag,
    contact_made: Phone,
    purchase: DollarSign,
    support_ticket: FileText,
    login: LogIn,
    export: FileText,
    import: FileText,
  };

  const IconComponent = iconMap[type] || Activity;

  const colorMap: Record<string, string> = {
    created: "text-green-400",
    updated: "text-blue-400",
    status_changed: "text-yellow-400",
    note_added: "text-purple-400",
    tag_added: "text-sky-400",
    tag_removed: "text-gray-400",
    contact_made: "text-green-400",
    purchase: "text-green-500",
    support_ticket: "text-orange-400",
    login: "text-blue-400",
    export: "text-slate-400",
    import: "text-slate-400",
  };

  return (
    <div className={`p-2 rounded-full bg-slate-800 ${colorMap[type] || "text-slate-400"}`}>
      <IconComponent className="h-4 w-4" />
    </div>
  );
}

interface AddActivityModalProps {
  onClose: () => void;
  onAdd: (activity: Omit<CustomerActivity, "id" | "customer_id" | "created_at">) => Promise<void>;
  logger: ActivityLogger;
}

function AddActivityModal({ onClose, onAdd, logger }: AddActivityModalProps) {
  const [formData, setFormData] = useState({
    activity_type: "contact_made",
    title: "",
    description: "",
    metadata: {} as Record<string, any>,
  });
  const [loading, setLoading] = useState(false);

  const activityTypes = [
    { value: "contact_made", label: "Contact Made" },
    { value: "updated", label: "Updated" },
    { value: "status_changed", label: "Status Changed" },
    { value: "note_added", label: "Note Added" },
    { value: "tag_added", label: "Tag Added" },
    { value: "tag_removed", label: "Tag Removed" },
    { value: "purchase", label: "Purchase" },
    { value: "support_ticket", label: "Support Ticket" },
    { value: "login", label: "Login" },
    { value: "export", label: "Export" },
    { value: "import", label: "Import" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      await onAdd(formData);
      onClose();
    } catch (error) {
      logger.error(
        "Failed to add activity",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Add Activity</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Activity Type</label>
            <select
              value={formData.activity_type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  activity_type: e.target.value,
                }))
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {activityTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Enter activity title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Enter activity description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Activity
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) {
    return "Just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (diffInMinutes < 10080) {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

function ActivityItem({ activity }: { activity: CustomerActivity }) {
  return (
    <div className="flex gap-3 p-4 bg-slate-800 rounded-lg">
      <ActivityIcon type={activity.activity_type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-white">{activity.title}</h4>
            {activity.description && (
              <p className="text-sm text-slate-400 mt-1">{activity.description}</p>
            )}
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-500 mb-1">Details:</div>
                <div className="bg-slate-700 rounded p-2 text-xs text-slate-300">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(activity.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 p-4 bg-slate-800 rounded-lg animate-pulse">
      <div className="w-8 h-8 bg-slate-700 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-700 rounded w-1/2" />
      </div>
      <div className="h-3 bg-slate-700 rounded w-16" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerActivities({
  customerId,
  useCustomerActivities,
  logger,
}: CustomerActivitiesProps) {
  const { activities, loading, error, addActivity } = useCustomerActivities(customerId);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddActivity = async (
    activityData: Omit<CustomerActivity, "id" | "customer_id" | "created_at">,
  ) => {
    await addActivity(activityData);
  };

  if (loading && activities.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Activities</h3>
          <button className="flex items-center gap-2 px-3 py-2 bg-sky-500 text-white rounded-lg opacity-50">
            <Plus className="h-4 w-4" />
            Add Activity
          </button>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <LoadingSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Activity className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Failed to load activities</h3>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Activities</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Activity
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No activities yet</h3>
          <p className="text-slate-400 mb-4">
            Activities will appear here as you interact with this customer.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add First Activity
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddActivityModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddActivity}
          logger={logger}
        />
      )}
    </div>
  );
}
