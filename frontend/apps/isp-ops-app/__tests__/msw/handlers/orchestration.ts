/**
 * MSW Handlers for Orchestration API Endpoints
 */

import { rest } from "msw";
import type {
  Workflow,
  WorkflowType,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepStatus,
  WorkflowStatistics,
  WorkflowListResponse,
} from "../../../hooks/useOrchestration";

// In-memory storage for test data
let workflows: Workflow[] = [];
let nextWorkflowId = 1;
let nextStepId = 1;

// Reset storage between tests
export function resetOrchestrationStorage() {
  workflows = [];
  nextWorkflowId = 1;
  nextStepId = 1;
}

// Helper to create a mock workflow step
export function createMockWorkflowStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: nextStepId++,
    step_id: `step-${nextStepId}`,
    step_name: "Test Step",
    step_type: "provision",
    target_system: "radius",
    status: "pending" as WorkflowStepStatus,
    step_order: 1,
    retry_count: 0,
    max_retries: 3,
    ...overrides,
  };
}

// Helper to create a mock workflow
export function createMockWorkflow(overrides?: Partial<Workflow>): Workflow {
  const workflowId = `workflow-${nextWorkflowId++}`;
  return {
    id: nextWorkflowId,
    workflow_id: workflowId,
    workflow_type: "provision_subscriber" as WorkflowType,
    status: "pending" as WorkflowStatus,
    tenant_id: "tenant-123",
    initiator_id: "user-123",
    initiator_type: "user",
    input_data: { subscriber_id: "sub-123" },
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed test data
export function seedOrchestrationData(workflowsData?: Workflow[]) {
  if (workflowsData) {
    workflows = [...workflowsData];
  }
}

// Helper to calculate workflow statistics
function calculateWorkflowStatistics(): WorkflowStatistics {
  const total = workflows.length;
  const pending = workflows.filter((w) => w.status === "pending").length;
  const running = workflows.filter((w) => w.status === "running").length;
  const completed = workflows.filter((w) => w.status === "completed").length;
  const failed = workflows.filter((w) => w.status === "failed").length;

  const success_rate = total > 0 ? (completed / total) * 100 : 0;

  // Calculate average duration for completed workflows
  const completedWorkflows = workflows.filter(
    (w) => w.status === "completed" && w.started_at && w.completed_at,
  );
  let avg_duration_seconds: number | undefined;
  if (completedWorkflows.length > 0) {
    const totalDuration = completedWorkflows.reduce((sum, w) => {
      const start = new Date(w.started_at!).getTime();
      const end = new Date(w.completed_at!).getTime();
      return sum + (end - start) / 1000;
    }, 0);
    avg_duration_seconds = totalDuration / completedWorkflows.length;
  }

  // Calculate counts by workflow type
  const by_type = workflows.reduce(
    (acc, workflow) => {
      acc[workflow.workflow_type] = (acc[workflow.workflow_type] || 0) + 1;
      return acc;
    },
    {} as Record<WorkflowType, number>,
  );

  return {
    total,
    pending,
    running,
    completed,
    failed,
    success_rate,
    avg_duration_seconds,
    by_type,
  };
}

export const orchestrationHandlers = [
  // GET /api/v1/orchestration/statistics - Get workflow statistics
  rest.get("*/orchestration/statistics", (req, res, ctx) => {
    const stats = calculateWorkflowStatistics();
    console.log("[MSW] stats handler", stats);
    return res(ctx.status(200), ctx.json(stats));
  }),

  // GET /api/v1/orchestration/workflows - List workflows
  rest.get("*/orchestration/workflows", (req, res, ctx) => {
    const status = req.url.searchParams.get("status");
    const workflowType = req.url.searchParams.get("workflow_type");
    const page = parseInt(req.url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(req.url.searchParams.get("page_size") || "20", 10);

    // Filter workflows
    let filteredWorkflows = [...workflows];
    if (status) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.status === status);
    }
    if (workflowType) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.workflow_type === workflowType);
    }

    // Sort by created_at descending
    filteredWorkflows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    // Paginate
    const total = filteredWorkflows.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedWorkflows = filteredWorkflows.slice(startIndex, endIndex);

    const response: WorkflowListResponse = {
      workflows: paginatedWorkflows,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };

    return res(ctx.status(200), ctx.json(response));
  }),

  // GET /api/v1/orchestration/workflows/:workflowId - Get single workflow
  rest.get("*/orchestration/workflows/:workflowId", (req, res, ctx) => {
    const { workflowId } = req.params;
    const workflow = workflows.find((w) => w.workflow_id === workflowId);

    if (!workflow) {
      return res(ctx.status(404), ctx.json({ detail: "Workflow not found" }));
    }

    return res(ctx.status(200), ctx.json(workflow));
  }),

  // POST /api/v1/orchestration/workflows/:workflowId/retry - Retry workflow
  rest.post("*/orchestration/workflows/:workflowId/retry", (req, res, ctx) => {
    const { workflowId } = req.params;
    const index = workflows.findIndex((w) => w.workflow_id === workflowId);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ detail: "Workflow not found" }));
    }

    // Update workflow status
    workflows[index] = {
      ...workflows[index],
      status: "pending",
      retry_count: workflows[index].retry_count + 1,
      updated_at: new Date().toISOString(),
      failed_at: undefined,
      error_message: undefined,
    };

    // Reset steps to pending if they exist
    if (workflows[index].steps) {
      workflows[index].steps = workflows[index].steps!.map((step) => ({
        ...step,
        status: step.status === "failed" ? "pending" : step.status,
        failed_at: undefined,
        error_message: undefined,
      }));
    }

    return res(ctx.status(200), ctx.json({ message: "Workflow retry initiated" }));
  }),

  // POST /api/v1/orchestration/workflows/:workflowId/cancel - Cancel workflow
  rest.post("*/orchestration/workflows/:workflowId/cancel", (req, res, ctx) => {
    const { workflowId } = req.params;
    const index = workflows.findIndex((w) => w.workflow_id === workflowId);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ detail: "Workflow not found" }));
    }

    // Only allow canceling pending or running workflows
    if (!["pending", "running"].includes(workflows[index].status)) {
      return res(
        ctx.status(400),
        ctx.json({ detail: "Can only cancel pending or running workflows" }),
      );
    }

    // Update workflow status to failed with cancellation message
    workflows[index] = {
      ...workflows[index],
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: "Workflow cancelled by user",
      updated_at: new Date().toISOString(),
    };

    return res(ctx.status(200), ctx.json({ message: "Workflow cancelled" }));
  }),

  // GET /api/v1/orchestration/export/csv - Export workflows as CSV
  rest.get("*/orchestration/export/csv", (req, res, ctx) => {
    const workflowType = req.url.searchParams.get("workflow_type");
    const status = req.url.searchParams.get("status");
    const dateFrom = req.url.searchParams.get("date_from");
    const dateTo = req.url.searchParams.get("date_to");
    const limit = req.url.searchParams.get("limit");

    // Filter workflows based on query params
    let filteredWorkflows = [...workflows];
    if (workflowType) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.workflow_type === workflowType);
    }
    if (status) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.status === status);
    }
    if (dateFrom) {
      filteredWorkflows = filteredWorkflows.filter(
        (w) => new Date(w.created_at) >= new Date(dateFrom),
      );
    }
    if (dateTo) {
      filteredWorkflows = filteredWorkflows.filter(
        (w) => new Date(w.created_at) <= new Date(dateTo),
      );
    }
    if (limit) {
      filteredWorkflows = filteredWorkflows.slice(0, parseInt(limit, 10));
    }

    // Create CSV content
    const headers = [
      "workflow_id",
      "workflow_type",
      "status",
      "tenant_id",
      "created_at",
      "started_at",
      "completed_at",
    ];
    const csvRows = [headers.join(",")];

    filteredWorkflows.forEach((w) => {
      csvRows.push(
        [
          w.workflow_id,
          w.workflow_type,
          w.status,
          w.tenant_id,
          w.created_at,
          w.started_at || "",
          w.completed_at || "",
        ].join(","),
      );
    });

    const csvContent = csvRows.join("\n");

    return res(
      ctx.status(200),
      ctx.set("Content-Type", "text/csv"),
      ctx.set("Content-Disposition", 'attachment; filename="workflows_export.csv"'),
      ctx.body(csvContent),
    );
  }),

  // GET /api/v1/orchestration/export/json - Export workflows as JSON
  rest.get("*/orchestration/export/json", (req, res, ctx) => {
    const workflowType = req.url.searchParams.get("workflow_type");
    const status = req.url.searchParams.get("status");
    const dateFrom = req.url.searchParams.get("date_from");
    const dateTo = req.url.searchParams.get("date_to");
    const limit = req.url.searchParams.get("limit");
    const includeSteps = req.url.searchParams.get("include_steps") === "true";

    // Filter workflows based on query params
    let filteredWorkflows = [...workflows];
    if (workflowType) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.workflow_type === workflowType);
    }
    if (status) {
      filteredWorkflows = filteredWorkflows.filter((w) => w.status === status);
    }
    if (dateFrom) {
      filteredWorkflows = filteredWorkflows.filter(
        (w) => new Date(w.created_at) >= new Date(dateFrom),
      );
    }
    if (dateTo) {
      filteredWorkflows = filteredWorkflows.filter(
        (w) => new Date(w.created_at) <= new Date(dateTo),
      );
    }
    if (limit) {
      filteredWorkflows = filteredWorkflows.slice(0, parseInt(limit, 10));
    }

    // Remove steps if not requested
    if (!includeSteps) {
      filteredWorkflows = filteredWorkflows.map((w) => {
        const { steps, ...workflowWithoutSteps } = w;
        return workflowWithoutSteps as Workflow;
      });
    }

    const jsonContent = JSON.stringify(filteredWorkflows, null, 2);

    return res(
      ctx.status(200),
      ctx.set("Content-Type", "application/json"),
      ctx.set("Content-Disposition", 'attachment; filename="workflows_export.json"'),
      ctx.body(jsonContent),
    );
  }),
];
