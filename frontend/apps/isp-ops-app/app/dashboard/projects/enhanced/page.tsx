"use client";

/**
 * Enhanced Project Management Page
 * Integrates Kanban Board, Gantt Chart, and Team Calendar
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { GanttChart } from "@/components/projects/GanttChart";
import { TeamCalendar } from "@/components/projects/TeamCalendar";
import { Layout, Calendar, BarChart3, Plus } from "lucide-react";

export default function EnhancedProjectsPage() {
  const [activeView, setActiveView] = useState<"kanban" | "gantt" | "calendar">("kanban");
  // Example project ID - in real app this would come from route params or selection
  const projectId = "project-1";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management</h1>
          <p className="text-muted-foreground">Track tasks, timelines, and team collaboration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">3 due this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">48</div>
            <p className="text-xs text-muted-foreground">12 in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">6 active today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-muted-foreground">+5% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="gantt" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        {/* Kanban View */}
        <TabsContent value="kanban" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Board</CardTitle>
              <CardDescription>
                Drag and drop tasks between columns to update their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KanbanBoard projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gantt View */}
        <TabsContent value="gantt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
              <CardDescription>View project schedule and task dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              <GanttChart projectId={projectId} project={undefined as any} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Calendar</CardTitle>
              <CardDescription>View team schedules, deadlines, and events</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamCalendar projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500 text-white rounded-lg">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Project Management Features
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Switch between Kanban board for task management, Gantt chart for timeline
                visualization, and Calendar for scheduling. All views are synchronized in real-time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
