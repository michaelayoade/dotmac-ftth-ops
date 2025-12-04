"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  User,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Eye,
  Ban,
} from "lucide-react";
import { useSiteSurveys } from "@/hooks/useCRM";
import type { SiteSurvey, SiteSurveyStatus, Serviceability } from "@/hooks/useCRM";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { ScheduleSurveyModal } from "@/components/crm/ScheduleSurveyModal";
import { CompleteSurveyModal } from "@/components/crm/CompleteSurveyModal";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";

export default function SiteSurveysPage() {
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SiteSurvey | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<SiteSurveyStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch surveys
  const { surveys, isLoading, refetch, startSurvey, cancelSurvey } = useSiteSurveys({});

  useEffect(() => {
    // Auto-refresh every 60 seconds
    const interval = setInterval(refetch, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Calculate statistics
  const stats = {
    scheduled: surveys.filter((s) => s.status === "scheduled").length,
    in_progress: surveys.filter((s) => s.status === "in_progress").length,
    completed: surveys.filter((s) => s.status === "completed").length,
    canceled: surveys.filter((s) => s.status === "canceled").length,
    completion_rate:
      surveys.length > 0
        ? ((surveys.filter((s) => s.status === "completed").length / surveys.length) * 100).toFixed(
            1,
          )
        : "0.0",
  };

  // Filter surveys
  const filteredSurveys = surveys.filter((survey) => {
    const matchesStatus = statusFilter === "all" || survey.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      survey.survey_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.lead_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status badge component
  const getStatusBadge = (status: SiteSurveyStatus) => {
    const styles: Record<SiteSurveyStatus, { variant: any; icon: any; label: string }> = {
      scheduled: { variant: "secondary", icon: Calendar, label: "Scheduled" },
      in_progress: { variant: "default", icon: Play, label: "In Progress" },
      completed: { variant: "outline", icon: CheckCircle2, label: "Completed" },
      failed: { variant: "destructive", icon: XCircle, label: "Failed" },
      canceled: { variant: "outline", icon: Ban, label: "Canceled" },
    };

    const style = styles[status];
    const Icon = style.icon;

    return (
      <Badge variant={style.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {style.label}
      </Badge>
    );
  };

  // Serviceability badge component
  const getServiceabilityBadge = (serviceability?: Serviceability) => {
    if (!serviceability) return <span className="text-muted-foreground text-sm">N/A</span>;

    const styles: Record<Serviceability, { color: string; label: string }> = {
      serviceable: {
        color: "bg-green-100 text-green-800",
        label: "Serviceable",
      },
      not_serviceable: {
        color: "bg-red-100 text-red-800",
        label: "Not Serviceable",
      },
      pending_expansion: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Pending Expansion",
      },
      requires_construction: {
        color: "bg-orange-100 text-orange-800",
        label: "Requires Construction",
      },
    };

    const style = styles[serviceability];

    return <Badge className={style.color}>{style.label}</Badge>;
  };

  const handleStartSurvey = async (survey: SiteSurvey) => {
    const success = await startSurvey(survey.id);
    if (success) {
      toast({
        title: "Survey Started",
        description: `Survey ${survey.survey_number} is now in progress`,
      });
      refetch();
    }
  };

  const handleCompleteSurvey = (survey: SiteSurvey) => {
    setSelectedSurvey(survey);
    setShowCompleteModal(true);
  };

  const handleCancelSurvey = async (survey: SiteSurvey) => {
    const confirmed = await confirmDialog({
      title: "Cancel site survey",
      description: `Are you sure you want to cancel survey ${survey.survey_number}?`,
      confirmText: "Cancel survey",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    const success = await cancelSurvey(survey.id, "Canceled by user");
    if (success) {
      toast({
        title: "Survey Canceled",
        description: `Survey ${survey.survey_number} has been canceled`,
      });
      refetch();
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Site Surveys</h1>
          <p className="text-muted-foreground">Schedule and manage technical site assessments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowScheduleModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Survey
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">Upcoming surveys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.in_progress}</div>
            <p className="text-xs text-muted-foreground">Currently on-site</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Finished surveys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceled</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.canceled}</div>
            <p className="text-xs text-muted-foreground">Canceled surveys</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completion_rate}%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All Surveys</CardTitle>
          <CardDescription>View and manage all scheduled site surveys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by survey number or lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Surveys Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No surveys found</h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Schedule your first site survey to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button className="mt-4" onClick={() => setShowScheduleModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Survey
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Survey #</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Serviceability</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSurveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">{survey.survey_number}</TableCell>
                    <TableCell>{survey.lead_id}</TableCell>
                    <TableCell>{new Date(survey.scheduled_date).toLocaleString()}</TableCell>
                    <TableCell>
                      {survey.technician_id ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{survey.technician_id}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(survey.status)}</TableCell>
                    <TableCell>{getServiceabilityBadge(survey.serviceability)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Open actions menu">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {}}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {survey.status === "scheduled" && (
                            <DropdownMenuItem onClick={() => handleStartSurvey(survey)}>
                              <Play className="h-4 w-4 mr-2" />
                              Start Survey
                            </DropdownMenuItem>
                          )}
                          {survey.status === "in_progress" && (
                            <DropdownMenuItem onClick={() => handleCompleteSurvey(survey)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Complete Survey
                            </DropdownMenuItem>
                          )}
                          {(survey.status === "scheduled" || survey.status === "in_progress") && (
                            <DropdownMenuItem
                              onClick={() => {
                                void handleCancelSurvey(survey);
                              }}
                              className="text-red-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Cancel Survey
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ScheduleSurveyModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        onSuccess={() => {
          refetch();
          setShowScheduleModal(false);
        }}
      />

      <CompleteSurveyModal
        open={showCompleteModal}
        onOpenChange={setShowCompleteModal}
        survey={selectedSurvey}
        onSuccess={() => {
          refetch();
          setShowCompleteModal(false);
          setSelectedSurvey(null);
        }}
      />
    </div>
  );
}
