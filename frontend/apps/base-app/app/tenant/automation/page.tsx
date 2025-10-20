'use client';

import { useState, useMemo } from 'react';
import {
  Play,
  RefreshCw,
  Search,
  StopCircle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Activity,
  FileCode,
  Zap,
  Server,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useAWXHealth,
  useJobTemplates,
  useJobs,
  useLaunchJob,
  useCancelJob,
} from '@/hooks/useAnsible';
import type { JobTemplate, Job } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

function ConnectionStatus() {
  const { data: health, isLoading } = useAWXHealth();

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (!health) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Unknown
      </Badge>
    );
  }

  return health.healthy ? (
    <Badge variant="default" className="gap-1 bg-green-600">
      <CheckCircle className="h-3 w-3" />
      Connected ({health.total_templates || 0} templates)
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Disconnected
    </Badge>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    running: {
      label: 'Running',
      icon: Activity,
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    successful: {
      label: 'Successful',
      icon: CheckCircle,
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    failed: {
      label: 'Failed',
      icon: XCircle,
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    canceled: {
      label: 'Canceled',
      icon: StopCircle,
      className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    },
  };

  const normalizedStatus = status.toLowerCase() as keyof typeof statusConfig;
  const configRecord =
    (statusConfig[normalizedStatus] ?? statusConfig.pending)!;
  const Icon = configRecord.icon;

  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${configRecord.className}`}>
      <Icon className="h-3 w-3" />
      {configRecord.label}
    </Badge>
  );
}

export default function AutomationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [extraVars, setExtraVars] = useState('{}');
  const { toast } = useToast();

  // API Hooks
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useJobTemplates();
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useJobs();
  const launchMutation = useLaunchJob();
  const cancelMutation = useCancelJob();

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchQuery === '' ||
        job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.toString().includes(searchQuery);

      const matchesTemplate =
        templateFilter === 'all' ||
        templates.find((t) => t.name === job.name && t.id.toString() === templateFilter);

      const matchesStatus = statusFilter === 'all' || job.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesTemplate && matchesStatus;
    });
  }, [jobs, searchQuery, templateFilter, statusFilter, templates]);

  // Calculate statistics
  const stats = useMemo(() => {
    const runningJobs = jobs.filter((j) => j.status.toLowerCase() === 'running').length;
    const successfulJobs = jobs.filter((j) => j.status.toLowerCase() === 'successful').length;
    const failedJobs = jobs.filter((j) => j.status.toLowerCase() === 'failed').length;

    return {
      total: jobs.length,
      running: runningJobs,
      successful: successfulJobs,
      failed: failedJobs,
    };
  }, [jobs]);

  const handleLaunchTemplate = (template: JobTemplate) => {
    setSelectedTemplate(template);
    setExtraVars('{}');
    setIsLaunchDialogOpen(true);
  };

  const handleLaunchJob = async () => {
    if (!selectedTemplate) return;

    try {
      let parsedVars: Record<string, any> | undefined;
      if (extraVars.trim()) {
        parsedVars = JSON.parse(extraVars);
      }

      const response = await launchMutation.mutateAsync({
        template_id: selectedTemplate.id,
        extra_vars: parsedVars,
      });

      toast({
        title: 'Job Launched',
        description: `Job #${response.job_id} has been launched successfully. Status: ${response.status}`,
      });

      setIsLaunchDialogOpen(false);
      refetchJobs();
    } catch (error) {
      toast({
        title: 'Failed to Launch Job',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    try {
      await cancelMutation.mutateAsync({ jobId });
      toast({
        title: 'Job Canceled',
        description: `Job #${jobId} has been canceled.`,
      });
      refetchJobs();
    } catch (error) {
      toast({
        title: 'Failed to Cancel Job',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Ansible Automation</h1>
          <p className="text-slate-400 mt-1">Manage automation workflows and job executions</p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Jobs</p>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Running</p>
                <p className="text-3xl font-bold text-white">{stats.running}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Successful</p>
                <p className="text-3xl font-bold text-white">{stats.successful}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Failed</p>
                <p className="text-3xl font-bold text-white">{stats.failed}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job Templates Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Job Templates</CardTitle>
              <CardDescription>Available automation playbooks</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchTemplates()} disabled={templatesLoading}>
              <RefreshCw className={`h-4 w-4 ${templatesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileCode className="h-12 w-12 text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg mb-2">No templates found</p>
              <p className="text-slate-500 text-sm">Configure AWX to see available templates</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-slate-400" />
                        <h3 className="text-white font-medium text-sm">{template.name}</h3>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-slate-400 text-xs mb-3 line-clamp-2">{template.description}</p>
                    )}
                    {template.playbook && (
                      <p className="text-slate-500 text-xs mb-3 font-mono">{template.playbook}</p>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleLaunchTemplate(template)}
                    >
                      <Play className="h-3 w-3 mr-2" />
                      Launch
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Execution History */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Job Execution History</CardTitle>
          <CardDescription>Recent automation job runs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="All Templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => refetchJobs()} disabled={jobsLoading} className="border-slate-700">
              <RefreshCw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Jobs List */}
          <ScrollArea className="h-[600px]">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg mb-2">No jobs found</p>
                <p className="text-slate-500 text-sm">
                  {searchQuery || templateFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Launch a template to see job executions'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-medium font-mono text-sm">#{job.id}</h3>
                            <span className="text-slate-400 text-sm">{job.name}</span>
                            <JobStatusBadge status={job.status} />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <div className="flex items-center text-slate-400">
                              <Clock className="h-3 w-3 mr-2" />
                              Created: {formatDistanceToNow(new Date(job.created), { addSuffix: true })}
                            </div>
                            {job.started && (
                              <div className="flex items-center text-slate-400">
                                <Play className="h-3 w-3 mr-2" />
                                Started: {formatDistanceToNow(new Date(job.started), { addSuffix: true })}
                              </div>
                            )}
                            {job.finished && (
                              <div className="flex items-center text-slate-400">
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Finished: {formatDistanceToNow(new Date(job.finished), { addSuffix: true })}
                              </div>
                            )}
                            {job.elapsed && (
                              <div className="flex items-center text-slate-400">
                                <Activity className="h-3 w-3 mr-2" />
                                Duration: {job.elapsed.toFixed(2)}s
                              </div>
                            )}
                          </div>
                        </div>

                        {job.status.toLowerCase() === 'running' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelJob(job.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <StopCircle className="h-3 w-3 mr-2" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Launch Job Dialog */}
      <Dialog open={isLaunchDialogOpen} onOpenChange={setIsLaunchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Launch Job Template</DialogTitle>
            <DialogDescription>
              Configure and launch {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Template</Label>
              <Input value={selectedTemplate?.name || ''} disabled className="bg-slate-900 border-slate-700" />
            </div>

            {selectedTemplate?.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-slate-400">{selectedTemplate.description}</p>
              </div>
            )}

            <div>
              <Label htmlFor="extra-vars">Extra Variables (JSON)</Label>
              <Textarea
                id="extra-vars"
                value={extraVars}
                onChange={(e) => setExtraVars(e.target.value)}
                placeholder='{"key": "value"}'
                className="font-mono text-xs bg-slate-900 border-slate-700 text-white min-h-[120px]"
              />
              <p className="text-xs text-slate-500 mt-1">
                Optional: Provide additional variables in JSON format
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLaunchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLaunchJob} disabled={launchMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {launchMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Launch Job
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
