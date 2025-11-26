"use client";

/**
 * Project Management Dashboard
 * Main page for viewing and managing projects with strict TypeScript
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useProjects, useProjectMetrics, useTeams } from "@/hooks/useProjects";
import { Project, ProjectStatus, ProjectPriority, ProjectFilter } from "@/types/project-management";

// ============================================================================
// Metrics Card Component
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend?: number;
}

function MetricCard({ title, value, icon: Icon, color, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp
                  className={`h-4 w-4 mr-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
                />
                <span className={trend >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(trend)}%
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Project Card Component
// ============================================================================

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  teamNameById: Map<string, string>;
}

function ProjectCard({ project, onSelect, teamNameById }: ProjectCardProps) {
  const statusColors: Record<ProjectStatus, string> = {
    DRAFT: "bg-gray-200 text-gray-800",
    PLANNING: "bg-blue-200 text-blue-800",
    ACTIVE: "bg-green-200 text-green-800",
    ON_HOLD: "bg-yellow-200 text-yellow-800",
    COMPLETED: "bg-purple-200 text-purple-800",
    CANCELLED: "bg-red-200 text-red-800",
    ARCHIVED: "bg-gray-200 text-gray-800",
  };

  const priorityColors: Record<ProjectPriority, string> = {
    LOW: "text-gray-600",
    MEDIUM: "text-blue-600",
    HIGH: "text-orange-600",
    CRITICAL: "text-red-600",
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect(project)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <Badge className={statusColors[project.status]}>{project.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Tasks */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>
                {project.completedTasks}/{project.totalTasks} tasks
              </span>
            </div>
            {project.endDate && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-muted-foreground">
                  Due {new Date(project.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {project.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {project.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{project.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                {(teamNameById.get(project.ownerId) ?? project.owner.name ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <span className="text-sm text-muted-foreground">
                {teamNameById.get(project.ownerId) ?? project.owner.name ?? "Unassigned"}
              </span>
            </div>
            <div className={`text-sm font-medium ${priorityColors[project.priority]}`}>
              {project.priority}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function ProjectDashboard() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>({});

  const trimmedSearch = searchQuery.trim();
  const { data: projectsData, isLoading } = useProjects({
    ...filter,
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
  });
  const { data: metrics } = useProjectMetrics();
  const { data: teams } = useTeams();

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((team) => map.set(team.id, team.name));
    return map;
  }, [teams]);

  const handleProjectSelect = (project: Project) => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  const handleCreateProject = () => {
    router.push("/dashboard/projects/new");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all your projects in one place
          </p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Projects"
            value={metrics.totalProjects}
            icon={LayoutGrid}
            color="bg-blue-600"
          />
          <MetricCard
            title="Active Projects"
            value={metrics.activeProjects}
            icon={CheckCircle2}
            color="bg-green-600"
          />
          <MetricCard
            title="Completed"
            value={metrics.completedProjects}
            icon={CheckCircle2}
            color="bg-purple-600"
          />
          <MetricCard
            title="Overdue"
            value={metrics.overdueProjects}
            icon={AlertCircle}
            color="bg-red-600"
          />
        </div>
      )}

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              onValueChange={(val) => {
                if (val) {
                  setFilter((prev) => ({ ...prev, ownerId: [val] }));
                } else {
                  setFilter((prev) => {
                    const { ownerId, ...rest } = prev;
                    return rest;
                  });
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All teams</SelectItem>
                {(teams ?? []).map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      ) : projectsData && projectsData.projects.length > 0 ? (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {projectsData.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={handleProjectSelect}
              teamNameById={teamNameById}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first project</p>
            <Button onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
