"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import {
  useServiceInstance,
  useServiceInstances,
  useResumeService,
  useSuspendService,
} from "@/hooks/useServiceLifecycle";
import { useScheduledJobs, useJobChains, useExecuteJobChain } from "@/hooks/useScheduler";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { DunningCampaign } from "@/types";
import { CampaignControlDialog } from "@/components/CampaignControlDialog";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export default function AutomationOverviewPage() {
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [chainDialogOpen, setChainDialogOpen] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const { data: provisioning } = useServiceInstances({
    status: "provisioning",
    limit: 10,
  });
  const { data: failed } = useServiceInstances({
    status: "provisioning_failed",
    limit: 10,
  });
  const { toast } = useToast();
  const { data: scheduledJobs, isLoading: jobsLoading } = useScheduledJobs();
  const { data: jobChains, isLoading: chainsLoading } = useJobChains();
  const { data: selectedService, isLoading: serviceLoading } =
    useServiceInstance(selectedServiceId);
  const suspendService = useSuspendService();
  const resumeService = useResumeService();
  const executeChain = useExecuteJobChain();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  const selectedCampaign: DunningCampaign | null = selectedCampaignId
    ? (campaigns?.find((c) => c.id === selectedCampaignId) ?? null)
    : null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Automation</h1>
        <p className="text-sm text-muted-foreground">
          Monitor orchestration workflows powered by Celery, the job scheduler, and service
          lifecycle automation.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Provisioning workflows</CardTitle>
          <CardDescription>
            Live jobs pulled from <code>/api/v1/services/lifecycle/services</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(provisioning ?? []).map((service) => (
                <TableRow
                  key={service.id}
                  className="cursor-pointer hover:bg-accent/30"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setServiceDialogOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-foreground">
                    {service.service_name}
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                    {service.service_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{service.provisioning_status ?? service.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(service.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {!(provisioning?.length ?? 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No provisioning workflows currently running.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Failed workflows</CardTitle>
          <CardDescription>
            Service lifecycle jobs that require operator intervention before retrying.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(failed ?? []).map((service) => (
                <TableRow
                  key={service.id}
                  className="cursor-pointer hover:bg-accent/30"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setServiceDialogOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-foreground">
                    {service.service_name}
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                    {service.service_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{service.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(service.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {!(failed?.length ?? 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No failed workflows detected.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled jobs</CardTitle>
          <CardDescription>
            Recurring automation configured via <code>/api/v1/jobs/scheduler</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading scheduled jobs…
                  </TableCell>
                </TableRow>
              )}
              {!jobsLoading && (scheduledJobs?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No recurring jobs configured.
                  </TableCell>
                </TableRow>
              )}
              {scheduledJobs?.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium text-foreground">{job.name}</TableCell>
                  <TableCell className="uppercase text-xs tracking-wide text-muted-foreground">
                    {job.job_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    {job.cron_expression ??
                      (job.interval_seconds ? `${job.interval_seconds}s` : "Manual")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.is_active ? "outline" : "secondary"}>
                      {job.is_active ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job chains</CardTitle>
          <CardDescription>
            Multi-step workflows (sequential or parallel) registered with the scheduler.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Execution mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chainsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading job chains…
                  </TableCell>
                </TableRow>
              )}
              {!chainsLoading && (jobChains?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No job chains configured.
                  </TableCell>
                </TableRow>
              )}
              {jobChains?.map((chain) => (
                <TableRow
                  key={chain.id}
                  className="hover:bg-accent/30 cursor-pointer"
                  onClick={() => {
                    setSelectedChainId(chain.id);
                    setChainDialogOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-foreground">{chain.name}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                    {chain.execution_mode}
                  </TableCell>
                  <TableCell>
                    <Badge variant={chain.status === "active" ? "outline" : "secondary"}>
                      {chain.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {chain.current_step}/{chain.total_steps}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(chain.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={executeChain.isPending}
                      onClick={async (event) => {
                        event.stopPropagation();
                        try {
                          await executeChain.mutateAsync({ chainId: chain.id });
                          toast({
                            title: "Job chain started",
                            description: `${chain.name} execution queued.`,
                          });
                        } catch (error) {
                          logger.error(
                            "Failed to execute job chain",
                            error instanceof Error ? error : new Error(String(error)),
                          );
                          toast({
                            title: "Execution failed",
                            description: "Unable to start job chain. Check logs for details.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Run now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dunning campaigns</CardTitle>
          <CardDescription>Monitor and control dunning automation campaigns.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Recovered</TableHead>
                <TableHead className="text-right">Controls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignsLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading campaigns…
                  </TableCell>
                </TableRow>
              )}
              {!campaignsLoading && (campaigns?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No campaigns configured.
                  </TableCell>
                </TableRow>
              )}
              {campaigns?.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium text-foreground">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant={campaign.is_active ? "outline" : "secondary"}>
                      {campaign.is_active ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.trigger_after_days} days</TableCell>
                  <TableCell>{campaign.total_executions}</TableCell>
                  <TableCell>
                    $
                    {(campaign.total_recovered_amount / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setCampaignDialogOpen(true);
                      }}
                    >
                      Control
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Service instance</DialogTitle>
            <DialogDescription>
              {selectedServiceId ? (
                <>
                  Details for <code>{selectedServiceId}</code>
                </>
              ) : (
                "Select a service to view details."
              )}
            </DialogDescription>
          </DialogHeader>

          {serviceLoading ? (
            <p className="text-sm text-muted-foreground">Loading service details…</p>
          ) : selectedService ? (
            <div className="grid gap-4 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Service name</span>
                  <span className="font-medium text-foreground">
                    {selectedService.service_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Identifier</span>
                  <span className="font-mono text-xs text-foreground">
                    {selectedService.service_identifier}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline">{selectedService.service_type.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={selectedService.status === "active" ? "outline" : "secondary"}>
                    {selectedService.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provisioned</span>
                  <span>
                    {selectedService.provisioned_at
                      ? new Date(selectedService.provisioned_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Activated</span>
                  <span>
                    {selectedService.activated_at
                      ? new Date(selectedService.activated_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              {selectedService.service_config && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Configuration
                  </p>
                  <pre className="max-h-48 overflow-y-auto rounded border border-border/60 bg-muted p-3 text-xs">
                    {JSON.stringify(selectedService.service_config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a service row to load details.</p>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Manage lifecycle status for the selected service.
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!selectedService || suspendService.isPending || resumeService.isPending}
                onClick={async () => {
                  if (!selectedService) return;
                  try {
                    await suspendService.mutateAsync({
                      serviceId: selectedService.id,
                    });
                    toast({
                      title: "Service suspended",
                      description: `${selectedService.service_name} marked suspended.`,
                    });
                  } catch (error) {
                    logger.error(
                      "Failed to suspend service",
                      error instanceof Error ? error : new Error(String(error)),
                    );
                    toast({
                      title: "Suspend failed",
                      description: "Unable to suspend service. Check logs for details.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Suspend
              </Button>
              <Button
                variant="outline"
                disabled={!selectedService || suspendService.isPending || resumeService.isPending}
                onClick={async () => {
                  if (!selectedService) return;
                  try {
                    await resumeService.mutateAsync({
                      serviceId: selectedService.id,
                    });
                    toast({
                      title: "Service resumed",
                      description: `${selectedService.service_name} restored.`,
                    });
                  } catch (error) {
                    logger.error(
                      "Failed to resume service",
                      error instanceof Error ? error : new Error(String(error)),
                    );
                    toast({
                      title: "Resume failed",
                      description: "Unable to resume service. Check logs for details.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Resume
              </Button>
              <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chainDialogOpen} onOpenChange={setChainDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job chain</DialogTitle>
            <DialogDescription>
              {selectedChainId ? (
                <>
                  Execution details for <code>{selectedChainId}</code>
                </>
              ) : (
                "Select a job chain to view details."
              )}
            </DialogDescription>
          </DialogHeader>
          {chainsLoading ? (
            <p className="text-sm text-muted-foreground">Loading job chain…</p>
          ) : selectedChainId ? (
            (() => {
              const chain = jobChains?.find((jobChain) => jobChain.id === selectedChainId);
              if (!chain) {
                return <p className="text-sm text-muted-foreground">Job chain not found.</p>;
              }
              return (
                <div className="space-y-4 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium text-foreground">{chain.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Execution mode</span>
                      <Badge variant="outline">{chain.execution_mode}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={chain.status === "active" ? "outline" : "secondary"}>
                        {chain.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Steps completed</span>
                      <span>
                        {chain.current_step}/{chain.total_steps}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last error</span>
                      <span className="text-xs text-muted-foreground">
                        {chain.error_message ?? "—"}
                      </span>
                    </div>
                  </div>

                  {chain.chain_definition && chain.chain_definition.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Chain definition
                      </p>
                      <pre className="max-h-48 overflow-y-auto rounded border border-border/60 bg-muted p-3 text-xs">
                        {JSON.stringify(chain.chain_definition, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground">Select a job chain to view details.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChainDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignControlDialog
        campaign={selectedCampaign}
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
      />
    </main>
  );
}
