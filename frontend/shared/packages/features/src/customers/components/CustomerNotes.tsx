import {
  MessageSquare,
  Plus,
  Eye,
  EyeOff,
  Clock,
  User,
  Building,
  Loader2,
  Filter,
  Search,
} from "lucide-react";
import { useState } from "react";

export interface CustomerNote {
  id: string;
  customer_id: string;
  note_type: string | undefined;
  content: string;
  is_internal: boolean;
  tags: string[] | undefined;
  metadata: Record<string, unknown> | undefined;
  created_at: string;
  updated_at: string | undefined;
  created_by: string;
  created_by_name: string | undefined;
}

export interface CustomerNotesProps {
  customerId: string;
  notes: CustomerNote[];
  loading: boolean;
  error: Error | null;
  addNote: (
    note: Omit<CustomerNote, "id" | "customer_id" | "created_at" | "updated_at" | "created_by">,
  ) => Promise<void>;
}

interface NoteIconProps {
  note_type: string;
}

function NoteIcon({ note_type }: NoteIconProps) {
  const iconMap: Record<string, React.ElementType> = {
    general: MessageSquare,
    internal: User,
    customer_facing: Building,
    support: MessageSquare,
    sales: MessageSquare,
    billing: MessageSquare,
  };

  const IconComponent = iconMap[note_type] || MessageSquare;

  const colorMap: Record<string, string> = {
    general: "text-slate-400",
    internal: "text-yellow-400",
    customer_facing: "text-green-400",
    support: "text-orange-400",
    sales: "text-blue-400",
    billing: "text-purple-400",
  };

  return (
    <div className={`p-2 rounded-full bg-slate-800 ${colorMap[note_type] || "text-slate-400"}`}>
      <IconComponent className="h-4 w-4" />
    </div>
  );
}

interface AddNoteModalProps {
  onClose: () => void;
  onAdd: (
    note: Omit<CustomerNote, "id" | "customer_id" | "created_at" | "updated_at" | "created_by">,
  ) => Promise<void>;
}

function AddNoteModal({ onClose, onAdd }: AddNoteModalProps) {
  const [formData, setFormData] = useState<
    Omit<CustomerNote, "id" | "customer_id" | "created_at" | "updated_at" | "created_by"> & {
      tags: string[];
    }
  >({
    note_type: "general",
    content: "",
    is_internal: false,
    tags: [],
    metadata: {},
    created_by_name: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const noteTypes = [
    { value: "general", label: "General Note" },
    { value: "internal", label: "Internal Note" },
    { value: "customer_facing", label: "Customer Facing" },
    { value: "support", label: "Support Note" },
    { value: "sales", label: "Sales Note" },
    { value: "billing", label: "Billing Note" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    setLoading(true);
    try {
      await onAdd(formData);
      onClose();
    } catch (error) {
      console.error(
        "Failed to add note",
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
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
          <h3 className="text-lg font-semibold text-white">Add Note</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Note Type</label>
            <select
              value={formData.note_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, note_type: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {noteTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Enter note content"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_internal"
              checked={formData.is_internal}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  is_internal: e.target.checked,
                }))
              }
              className="h-4 w-4 text-sky-600 bg-slate-800 border-slate-600 rounded focus:ring-sky-500"
            />
            <label htmlFor="is_internal" className="text-sm text-slate-300">
              Internal note (not visible to customer)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Add tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-sky-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              disabled={loading || !formData.content.trim()}
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
                  Add Note
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

function NoteItem({ note }: { note: CustomerNote }) {
  const noteType = note.note_type ?? "general";
  const tags = note.tags ?? [];
  const metadataEntries = Object.entries(note.metadata ?? {});

  return (
    <div className="flex gap-3 p-4 bg-slate-800 rounded-lg">
      <NoteIcon note_type={noteType} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 capitalize">
                {noteType.replace(/_/g, " ")}
              </span>
              {note.is_internal && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-xs">
                  <EyeOff className="h-3 w-3" />
                  Internal
                </div>
              )}
            </div>
            <div className="text-sm text-white whitespace-pre-wrap mb-2">{note.content}</div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {metadataEntries.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-500 mb-1">Additional Details:</div>
                <div className="bg-slate-700 rounded p-2 text-xs text-slate-300">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
            <Clock className="h-3 w-3" />
            {formatDate(note.created_at)}
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
        <div className="h-3 bg-slate-700 rounded w-16" />
        <div className="h-4 bg-slate-700 rounded w-full" />
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="flex gap-2">
          <div className="h-6 bg-slate-700 rounded w-12" />
          <div className="h-6 bg-slate-700 rounded w-16" />
        </div>
      </div>
      <div className="h-3 bg-slate-700 rounded w-16" />
    </div>
  );
}

export function CustomerNotes({ customerId, notes, loading, error, addNote }: CustomerNotesProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "internal" | "external">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>("all");

  const handleAddNote = async (
    noteData: Omit<CustomerNote, "id" | "customer_id" | "created_at" | "updated_at" | "created_by">,
  ) => {
    await addNote(noteData);
    setShowAddModal(false);
  };

  const filteredNotes = notes.filter((note: CustomerNote) => {
    const matchesVisibility =
      filter === "all" ||
      (filter === "internal" && note.is_internal) ||
      (filter === "external" && !note.is_internal);

    const matchesSearch =
      !searchQuery ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.tags ?? []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = noteTypeFilter === "all" || note.note_type === noteTypeFilter;

    return matchesVisibility && matchesSearch && matchesType;
  });

  const noteTypes = [
    { value: "all", label: "All Types" },
    { value: "general", label: "General" },
    { value: "internal", label: "Internal" },
    { value: "customer_facing", label: "Customer Facing" },
    { value: "support", label: "Support" },
    { value: "sales", label: "Sales" },
    { value: "billing", label: "Billing" },
  ];

  if (loading && notes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Notes</h3>
          <button className="flex items-center gap-2 px-3 py-2 bg-sky-500 text-white rounded-lg opacity-50">
            <Plus className="h-4 w-4" />
            Add Note
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
        <MessageSquare className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Failed to load notes</h3>
        <p className="text-slate-400">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Notes</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Note
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "internal" | "external")}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Notes</option>
            <option value="internal">Internal Only</option>
            <option value="external">External Only</option>
          </select>
        </div>

        <select
          value={noteTypeFilter}
          onChange={(e) => setNoteTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {noteTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          {notes.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No notes yet</h3>
              <p className="text-slate-400 mb-4">
                Add notes to keep track of important information about this customer.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors mx-auto"
              >
                <Plus className="h-4 w-4" />
                Add First Note
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No matching notes</h3>
              <p className="text-slate-400">Try adjusting your search criteria or filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddNoteModal onClose={() => setShowAddModal(false)} onAdd={handleAddNote} />
      )}
    </div>
  );
}
