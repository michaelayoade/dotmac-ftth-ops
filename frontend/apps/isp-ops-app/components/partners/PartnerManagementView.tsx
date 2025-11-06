"use client";

import { useState } from "react";
import { usePartners, useDeletePartner, Partner } from "@/hooks/usePartners";
import { Users, Plus } from "lucide-react";
import PartnerMetrics from "@/components/partners/PartnerMetrics";
import PartnersList from "@/components/partners/PartnersList";
import CreatePartnerModal from "@/components/partners/CreatePartnerModal";
import { PageHeader } from "@dotmac/ui";
import { EmptyState } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { ConfirmDialog } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export function PartnerManagementView() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, error } = usePartners(statusFilter);
  const deletePartner = useDeletePartner();

  const handleEdit = (partner: Partner) => {
    setSelectedPartner(partner);
    setShowCreateModal(true);
  };

  const handleDelete = (partnerId: string) => {
    setPartnerToDelete(partnerId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!partnerToDelete) return;

    setIsDeleting(true);
    try {
      await deletePartner.mutateAsync(partnerToDelete);
      logger.info("Partner deleted successfully", {
        partnerId: partnerToDelete,
      });
      setShowDeleteDialog(false);
      setPartnerToDelete(null);
    } catch (err) {
      logger.error("Failed to delete partner", {
        partnerId: partnerToDelete,
        error: err,
      });
      alert("Failed to delete partner");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedPartner(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="py-12 text-center text-muted-foreground" role="status" aria-live="polite">
          Loading partners…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState.Error
          title="Failed to load partners"
          description={(error as Error).message}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const partners = data?.partners ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Partner Management"
        description="Manage partner relationships and track performance."
        icon={Users}
        actions={
          <Button onClick={() => setShowCreateModal(true)} aria-label="Create new partner">
            <Plus className="mr-2 h-4 w-4" />
            Create partner
          </Button>
        }
      />

      <PartnerMetrics partners={partners} />

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="w-full md:w-64">
          <label
            htmlFor="partner-status-filter"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Filter by status
          </label>
          <select
            id="partner-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Filter partners by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Showing {partners.length} partner{partners.length === 1 ? "" : "s"}
        </div>
      </div>

      {partners.length === 0 ? (
        <EmptyState.List
          entityName="partners"
          onCreateClick={() => setShowCreateModal(true)}
          icon={Users}
        />
      ) : (
        <PartnersList partners={partners} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {showCreateModal && (
        <CreatePartnerModal partner={selectedPartner} onClose={handleCloseModal} />
      )}

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete partner"
        description="Are you sure you want to delete this partner? This action cannot be undone."
        confirmText="Delete partner"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
