'use client';

import { useState } from 'react';
import { Calendar, Clock, Play, Pause, Trash2, Edit, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useScheduledJobs,
  useJobChains,
  useCreateScheduledJob,
  useUpdateScheduledJob,
  useToggleScheduledJob,
  useDeleteScheduledJob,
  useCreateJobChain,
  useExecuteJobChain,
} from '@/hooks/useScheduler';
import { useToast } from '@/components/ui/use-toast';
import {
  type ScheduledJobCreate,
  type ScheduledJobResponse,
  type JobChainCreate,
  type JobChainResponse as JobChain,
  JobPriority,
  JobExecutionMode,
} from '@/types';

export default function JobSchedulerPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [createScheduledJobOpen, setCreateScheduledJobOpen] = useState(false);
  const [createJobChainOpen, setCreateJobChainOpen] = useState(false);

  // Fetch data
  const { data: scheduledJobsData, isLoading: jobsLoading } = useScheduledJobs();
  const { data: jobChainsData, isLoading: chainsLoading } = useJobChains();

  // Mutations
  const createScheduledJob = useCreateScheduledJob();
  const updateScheduledJob = useUpdateScheduledJob();
  const toggleScheduledJob = useToggleScheduledJob();
  const deleteScheduledJob = useDeleteScheduledJob();
  const createJobChain = useCreateJobChain();
  const executeJobChain = useExecuteJobChain();

  const scheduledJobs = scheduledJobsData || [];
  const jobChains = jobChainsData || [];

  // Calculate statistics
  const activeJobs = scheduledJobs.filter(j => j.is_active).length;
  const totalRuns = scheduledJobs.reduce((sum, j) => sum + (j.total_runs || 0), 0);
  const successfulRuns = scheduledJobs.reduce((sum, j) => sum + (j.successful_runs || 0), 0);
  const failedRuns = scheduledJobs.reduce((sum, j) => sum + (j.failed_runs || 0), 0);

  const handleToggleJob = async (jobId: string) => {
    try {
      await toggleScheduledJob.mutateAsync(jobId);
      toast({
        title: 'Success',
        description: 'Job status toggled successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to toggle job',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) return;

    try {
      await deleteScheduledJob.mutateAsync(jobId);
      toast({
        title: 'Success',
        description: 'Job deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete job',
        variant: 'destructive',
      });
    }
  };

  const handleExecuteChain = async (chainId: string) => {
    try {
      await executeJobChain.mutateAsync({ chainId });
      toast({
        title: 'Success',
        description: 'Job chain execution started',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to execute chain',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Scheduler</h1>
          <p className="text-muted-foreground mt-1">
            Manage scheduled jobs and job chains
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scheduled Jobs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledJobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeJobs} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <Play className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successfulRuns}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedRuns}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="scheduled">Scheduled Jobs</TabsTrigger>
            <TabsTrigger value="chains">Job Chains</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {activeTab === 'scheduled' && (
              <CreateScheduledJobDialog
                open={createScheduledJobOpen}
                onOpenChange={setCreateScheduledJobOpen}
                onSubmit={async (data) => {
                  try {
                    await createScheduledJob.mutateAsync(data);
                    setCreateScheduledJobOpen(false);
                    toast({
                      title: 'Success',
                      description: 'Scheduled job created successfully',
                    });
                  } catch (error: any) {
                    toast({
                      title: 'Error',
                      description: error?.message || 'Failed to create scheduled job',
                      variant: 'destructive',
                    });
                  }
                }}
              />
            )}
            {activeTab === 'chains' && (
              <CreateJobChainDialog
                open={createJobChainOpen}
                onOpenChange={setCreateJobChainOpen}
                onSubmit={async (data) => {
                  try {
                    await createJobChain.mutateAsync(data);
                    setCreateJobChainOpen(false);
                    toast({
                      title: 'Success',
                      description: 'Job chain created successfully',
                    });
                  } catch (error: any) {
                    toast({
                      title: 'Error',
                      description: error?.message || 'Failed to create job chain',
                      variant: 'destructive',
                    });
                  }
                }}
              />
            )}
          </div>
        </div>

        <TabsContent value="scheduled" className="space-y-4">
          {jobsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading scheduled jobs...
              </CardContent>
            </Card>
          ) : scheduledJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No scheduled jobs found. Create your first scheduled job to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduledJobs.map((job) => (
                <ScheduledJobCard
                  key={job.id}
                  job={job as any}
                  onToggle={() => handleToggleJob(job.id)}
                  onDelete={() => handleDeleteJob(job.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chains" className="space-y-4">
          {chainsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading job chains...
              </CardContent>
            </Card>
          ) : jobChains.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No job chains found. Create your first job chain to orchestrate workflows.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobChains.map((chain) => (
                <JobChainCard
                  key={chain.id}
                  chain={chain as JobChain}
                  onExecute={() => handleExecuteChain(chain.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Scheduled Job Card Component
function ScheduledJobCard({
  job,
  onToggle,
  onDelete,
}: {
  job: ScheduledJobResponse;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{job.name}</CardTitle>
          <Badge variant={job.is_active ? 'default' : 'secondary'}>
            {job.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <CardDescription>{job.description || job.job_type}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs">
            {job.cron_expression || `Every ${job.interval_seconds}s`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-semibold">{job.total_runs}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Success</div>
            <div className="font-semibold text-green-600">{job.successful_runs}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="font-semibold text-red-600">{job.failed_runs}</div>
          </div>
        </div>

        {job.next_run_at && (
          <div className="text-xs text-muted-foreground">
            Next run: {new Date(job.next_run_at).toLocaleString()}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onToggle} className="flex-1">
            {job.is_active ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {job.is_active ? 'Pause' : 'Activate'}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Job Chain Card Component
function JobChainCard({
  chain,
  onExecute,
}: {
  chain: JobChain;
  onExecute: () => void;
}) {
  const statusColors = {
    pending: 'secondary',
    running: 'default',
    completed: 'default',
    failed: 'destructive',
  } as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{chain.name}</CardTitle>
          <Badge variant={statusColors[chain.status as keyof typeof statusColors] || 'secondary'}>
            {chain.status}
          </Badge>
        </div>
        <CardDescription>{chain.description || chain.execution_mode}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Execution Mode</span>
          <Badge variant="outline">{chain.execution_mode}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Steps</span>
          <span className="font-semibold">
            {chain.current_step} / {chain.total_steps}
          </span>
        </div>

        {chain.started_at && (
          <div className="text-xs text-muted-foreground">
            Started: {new Date(chain.started_at).toLocaleString()}
          </div>
        )}

        {chain.error_message && (
          <div className="text-xs text-red-600 p-2 bg-red-50 rounded">
            {chain.error_message}
          </div>
        )}

        <Button size="sm" onClick={onExecute} className="w-full">
          <Play className="h-3 w-3 mr-1" />
          Execute Chain
        </Button>
      </CardContent>
    </Card>
  );
}

// Create Scheduled Job Dialog
function CreateScheduledJobDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ScheduledJobCreate) => void;
}) {
  const [formData, setFormData] = useState<ScheduledJobCreate>({
    name: '',
    job_type: '',
    cron_expression: null,
    interval_seconds: null,
    description: null,
    priority: JobPriority.NORMAL,
    max_retries: 3,
    retry_delay_seconds: 60,
    max_concurrent_runs: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Scheduled Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Scheduled Job</DialogTitle>
            <DialogDescription>
              Configure a new scheduled job with cron expression or interval
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Job Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_type">Job Type</Label>
                <Input
                  id="job_type"
                  value={formData.job_type}
                  onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cron_expression">Cron Expression</Label>
                <Input
                  id="cron_expression"
                  placeholder="0 0 * * *"
                  value={formData.cron_expression || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, cron_expression: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval_seconds">Interval (seconds)</Label>
                <Input
                  id="interval_seconds"
                  type="number"
                  placeholder="3600"
                  value={formData.interval_seconds || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interval_seconds: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value as JobPriority })
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_retries">Max Retries</Label>
                <Input
                  id="max_retries"
                  type="number"
                  value={formData.max_retries}
                  onChange={(e) =>
                    setFormData({ ...formData, max_retries: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Job</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Job Chain Dialog
function CreateJobChainDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: JobChainCreate) => void;
}) {
  const [formData, setFormData] = useState<JobChainCreate>({
    name: '',
    chain_definition: [],
    execution_mode: JobExecutionMode.SEQUENTIAL,
    description: null,
    stop_on_failure: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Job Chain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Job Chain</DialogTitle>
            <DialogDescription>
              Define a multi-step workflow with sequential or parallel execution
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chain_name">Chain Name</Label>
              <Input
                id="chain_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chain_description">Description</Label>
              <Textarea
                id="chain_description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution_mode">Execution Mode</Label>
              <Select
                value={formData.execution_mode}
                onValueChange={(value) =>
                  setFormData({ ...formData, execution_mode: value as JobExecutionMode })
                }
              >
                <SelectTrigger id="execution_mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chain Definition (JSON)</Label>
              <Textarea
                placeholder='[{"job_type": "example", "params": {}}]'
                className="font-mono text-sm"
                rows={6}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setFormData({ ...formData, chain_definition: parsed });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Chain</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
