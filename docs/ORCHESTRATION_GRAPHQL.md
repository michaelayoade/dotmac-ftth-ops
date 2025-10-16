# Orchestration Service - GraphQL Integration

## Overview

The Orchestration Service is fully integrated with GraphQL, providing both queries and mutations for workflow management and subscriber provisioning. This allows frontend applications to use either REST or GraphQL APIs based on their needs.

## Why GraphQL for Orchestration?

**Benefits:**
1. **Single Request** - Fetch workflow with all steps in one query
2. **Flexible Data** - Request only the fields you need
3. **Real-time Ready** - Easy to add subscriptions for workflow updates
4. **Type Safety** - Strong typing with schema validation
5. **Better DX** - Self-documenting API with GraphQL playground

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       GraphQL Layer                              │
│                                                                   │
│  Queries:                      Mutations:                        │
│  - workflow(id)                - provisionSubscriber()          │
│  - workflows(filter)           - retryWorkflow(id)              │
│  - workflowStatistics()        - cancelWorkflow(id)             │
│  - runningWorkflowsCount()                                       │
│  - hasRunningWorkflowFor...()                                    │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Orchestration Service                           │
│               (Shared by REST & GraphQL)                         │
└─────────────────────────────────────────────────────────────────┘
```

## GraphQL Queries

### 1. Get Single Workflow

**Query:**
```graphql
query GetWorkflow($workflowId: String!) {
  workflow(workflowId: $workflowId) {
    workflowId
    workflowType
    status
    startedAt
    completedAt
    failedAt
    errorMessage
    retryCount

    # Computed fields
    durationSeconds
    isTerminal
    completedStepsCount
    totalStepsCount

    # Steps
    steps {
      stepId
      stepName
      stepOrder
      targetSystem
      status
      startedAt
      completedAt
      failedAt
      errorMessage
      retryCount
      outputData
    }
  }
}
```

**Variables:**
```json
{
  "workflowId": "wf_a1b2c3d4e5f6"
}
```

**Response:**
```json
{
  "data": {
    "workflow": {
      "workflowId": "wf_a1b2c3d4e5f6",
      "workflowType": "PROVISION_SUBSCRIBER",
      "status": "COMPLETED",
      "startedAt": "2025-10-15T12:00:00Z",
      "completedAt": "2025-10-15T12:00:45Z",
      "failedAt": null,
      "errorMessage": null,
      "retryCount": 0,
      "durationSeconds": 45.2,
      "isTerminal": true,
      "completedStepsCount": 7,
      "totalStepsCount": 7,
      "steps": [
        {
          "stepId": "wf_a1b2c3d4e5f6_step_0",
          "stepName": "create_customer",
          "stepOrder": 0,
          "targetSystem": "database",
          "status": "COMPLETED",
          "startedAt": "2025-10-15T12:00:01Z",
          "completedAt": "2025-10-15T12:00:02Z",
          "failedAt": null,
          "errorMessage": null,
          "retryCount": 0,
          "outputData": "{\"customer_id\": \"cust_123\"}"
        }
        // ... more steps
      ]
    }
  }
}
```

### 2. List Workflows with Filtering

**Query:**
```graphql
query ListWorkflows(
  $filter: WorkflowFilterInput
) {
  workflows(filter: $filter) {
    workflows {
      workflowId
      workflowType
      status
      startedAt
      completedAt
      errorMessage
      durationSeconds
      completedStepsCount
      totalStepsCount
    }
    totalCount
    hasNextPage
  }
}
```

**Variables:**
```json
{
  "filter": {
    "workflowType": "PROVISION_SUBSCRIBER",
    "status": "FAILED",
    "limit": 20,
    "offset": 0
  }
}
```

**Response:**
```json
{
  "data": {
    "workflows": {
      "workflows": [
        {
          "workflowId": "wf_abc123",
          "workflowType": "PROVISION_SUBSCRIBER",
          "status": "FAILED",
          "startedAt": "2025-10-15T11:00:00Z",
          "completedAt": null,
          "errorMessage": "ONU activation failed: timeout",
          "durationSeconds": 65.3,
          "completedStepsCount": 4,
          "totalStepsCount": 7
        }
      ],
      "totalCount": 5,
      "hasNextPage": false
    }
  }
}
```

### 3. Get Workflow Statistics

**Query:**
```graphql
query GetWorkflowStatistics {
  workflowStatistics {
    totalWorkflows
    pendingWorkflows
    runningWorkflows
    completedWorkflows
    failedWorkflows
    rolledBackWorkflows
    successRate
    averageDurationSeconds
    totalCompensations
  }
}
```

**Response:**
```json
{
  "data": {
    "workflowStatistics": {
      "totalWorkflows": 1523,
      "pendingWorkflows": 12,
      "runningWorkflows": 5,
      "completedWorkflows": 1420,
      "failedWorkflows": 45,
      "rolledBackWorkflows": 41,
      "successRate": 93.2,
      "averageDurationSeconds": 42.5,
      "totalCompensations": 41
    }
  }
}
```

### 4. Check Running Workflows

**Query:**
```graphql
query CheckRunningWorkflow($customerId: String!) {
  hasRunningWorkflowForCustomer(customerId: $customerId)
  runningWorkflowsCount
}
```

**Variables:**
```json
{
  "customerId": "cust_123"
}
```

**Response:**
```json
{
  "data": {
    "hasRunningWorkflowForCustomer": false,
    "runningWorkflowsCount": 5
  }
}
```

## GraphQL Mutations

### 1. Provision Subscriber

**Mutation:**
```graphql
mutation ProvisionSubscriber($input: ProvisionSubscriberInput!) {
  provisionSubscriber(input: $input) {
    workflowId
    subscriberId
    customerId
    status

    # Created resources
    radiusUsername
    ipv4Address
    vlanId
    onuId
    cpeId
    serviceId

    # Workflow progress
    stepsCompleted
    totalSteps
    errorMessage

    createdAt
    completedAt
    isSuccessful

    # Nested workflow query
    workflow {
      workflowId
      status
      durationSeconds
      steps {
        stepName
        status
        errorMessage
      }
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-123-4567",
    "serviceAddress": "123 Main St",
    "serviceCity": "New York",
    "serviceState": "NY",
    "servicePostalCode": "10001",
    "serviceCountry": "USA",
    "servicePlanId": "plan_premium_1000",
    "bandwidthMbps": 1000,
    "connectionType": "ftth",
    "onuSerial": "ALCL12345678",
    "cpeMac": "00:11:22:33:44:55",
    "autoActivate": true,
    "createRadiusAccount": true,
    "allocateIpFromNetbox": true,
    "configureVoltha": true,
    "configureGenieacs": true
  }
}
```

**Response (Success):**
```json
{
  "data": {
    "provisionSubscriber": {
      "workflowId": "wf_a1b2c3d4e5f6",
      "subscriberId": "sub_789",
      "customerId": "cust_456",
      "status": "COMPLETED",
      "radiusUsername": "john.doe@example.com",
      "ipv4Address": "10.0.1.50",
      "vlanId": 100,
      "onuId": "onu_101",
      "cpeId": "cpe_202",
      "serviceId": "svc_303",
      "stepsCompleted": 7,
      "totalSteps": 7,
      "errorMessage": null,
      "createdAt": "2025-10-15T12:00:00Z",
      "completedAt": "2025-10-15T12:00:45Z",
      "isSuccessful": true,
      "workflow": {
        "workflowId": "wf_a1b2c3d4e5f6",
        "status": "COMPLETED",
        "durationSeconds": 45.2,
        "steps": [
          {
            "stepName": "create_customer",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "create_subscriber",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "create_radius_account",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "allocate_ip_address",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "activate_onu",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "configure_cpe",
            "status": "COMPLETED",
            "errorMessage": null
          },
          {
            "stepName": "create_billing_service",
            "status": "COMPLETED",
            "errorMessage": null
          }
        ]
      }
    }
  }
}
```

**Response (Failure with Rollback):**
```json
{
  "data": {
    "provisionSubscriber": {
      "workflowId": "wf_x1y2z3a4b5c6",
      "subscriberId": "",
      "customerId": "cust_789",
      "status": "ROLLED_BACK",
      "radiusUsername": null,
      "ipv4Address": null,
      "vlanId": null,
      "onuId": null,
      "cpeId": null,
      "serviceId": null,
      "stepsCompleted": 4,
      "totalSteps": 7,
      "errorMessage": "Step 5 (activate_onu) failed: ONU serial not found",
      "createdAt": "2025-10-15T12:00:00Z",
      "completedAt": null,
      "isSuccessful": false,
      "workflow": {
        "workflowId": "wf_x1y2z3a4b5c6",
        "status": "ROLLED_BACK",
        "durationSeconds": 32.1,
        "steps": [
          {
            "stepName": "create_customer",
            "status": "COMPENSATED",
            "errorMessage": null
          },
          {
            "stepName": "create_subscriber",
            "status": "COMPENSATED",
            "errorMessage": null
          },
          {
            "stepName": "create_radius_account",
            "status": "COMPENSATED",
            "errorMessage": null
          },
          {
            "stepName": "allocate_ip_address",
            "status": "COMPENSATED",
            "errorMessage": null
          },
          {
            "stepName": "activate_onu",
            "status": "FAILED",
            "errorMessage": "ONU serial not found"
          }
        ]
      }
    }
  }
}
```

### 2. Retry Failed Workflow

**Mutation:**
```graphql
mutation RetryWorkflow($workflowId: String!) {
  retryWorkflow(workflowId: $workflowId) {
    workflowId
    status
    retryCount
    steps {
      stepName
      status
    }
  }
}
```

**Variables:**
```json
{
  "workflowId": "wf_abc123"
}
```

### 3. Cancel Running Workflow

**Mutation:**
```graphql
mutation CancelWorkflow($workflowId: String!) {
  cancelWorkflow(workflowId: $workflowId) {
    workflowId
    status
    steps {
      stepName
      status
    }
  }
}
```

## Frontend Integration Examples

### React Hook with GraphQL

```typescript
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

// Query definition
const GET_WORKFLOW = gql`
  query GetWorkflow($workflowId: String!) {
    workflow(workflowId: $workflowId) {
      workflowId
      status
      durationSeconds
      completedStepsCount
      totalStepsCount
      steps {
        stepName
        status
        errorMessage
      }
    }
  }
`;

// Mutation definition
const PROVISION_SUBSCRIBER = gql`
  mutation ProvisionSubscriber($input: ProvisionSubscriberInput!) {
    provisionSubscriber(input: $input) {
      workflowId
      subscriberId
      status
      isSuccessful
      errorMessage
    }
  }
`;

// React component
function ProvisionSubscriberForm() {
  const [provisionSubscriber, { data, loading, error }] = useMutation(
    PROVISION_SUBSCRIBER
  );

  const handleSubmit = async (formData) => {
    try {
      const result = await provisionSubscriber({
        variables: { input: formData }
      });

      if (result.data.provisionSubscriber.isSuccessful) {
        toast.success('Subscriber provisioned successfully!');
      } else {
        toast.error(result.data.provisionSubscriber.errorMessage);
      }
    } catch (err) {
      toast.error('Failed to provision subscriber');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Provisioning...' : 'Provision Subscriber'}
      </button>
    </form>
  );
}

// Workflow monitoring component
function WorkflowMonitor({ workflowId }) {
  const { data, loading, error, refetch } = useQuery(GET_WORKFLOW, {
    variables: { workflowId },
    pollInterval: 2000, // Poll every 2 seconds for updates
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const workflow = data.workflow;

  return (
    <div>
      <h2>Workflow Status: {workflow.status}</h2>
      <p>Progress: {workflow.completedStepsCount} / {workflow.totalStepsCount}</p>
      <p>Duration: {workflow.durationSeconds}s</p>

      <ul>
        {workflow.steps.map(step => (
          <li key={step.stepName}>
            {step.stepName}: {step.status}
            {step.errorMessage && <span> - {step.errorMessage}</span>}
          </li>
        ))}
      </ul>

      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div>
    <div v-if="loading">Provisioning subscriber...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <div v-else-if="result">
      <div v-if="result.isSuccessful">
        ✅ Success! Subscriber ID: {{ result.subscriberId }}
      </div>
      <div v-else>
        ❌ Failed: {{ result.errorMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client';

export default {
  setup() {
    const { mutate, loading, error, onDone } = useMutation(gql`
      mutation ProvisionSubscriber($input: ProvisionSubscriberInput!) {
        provisionSubscriber(input: $input) {
          workflowId
          subscriberId
          isSuccessful
          errorMessage
        }
      }
    `);

    const provisionSubscriber = async (formData) => {
      await mutate({ input: formData });
    };

    return {
      provisionSubscriber,
      loading,
      error,
    };
  }
};
</script>
```

## Comparison: REST vs GraphQL

### REST API
```typescript
// ❌ REST: Multiple requests for complete data
const workflow = await fetch(`/api/v1/orchestration/workflows/${id}`);
const steps = workflow.steps; // Already included, but no flexibility

// To provision:
const result = await fetch('/api/v1/orchestration/provision-subscriber', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

### GraphQL API
```typescript
// ✅ GraphQL: Single request, flexible fields
const { data } = await apolloClient.query({
  query: GET_WORKFLOW,
  variables: { workflowId: id }
});

// Choose exactly what fields you need
const workflow = data.workflow;
```

## Advantages of GraphQL for Orchestration

### 1. Real-time Monitoring
```graphql
subscription WorkflowUpdates($workflowId: String!) {
  workflowUpdated(workflowId: $workflowId) {
    workflowId
    status
    completedStepsCount
    currentStep {
      stepName
      status
    }
  }
}
```
*(Subscriptions can be added in future)*

### 2. Nested Queries
```graphql
query GetProvisioningResult($workflowId: String!) {
  workflow(workflowId: $workflowId) {
    status
    # Nested query - get subscriber details in same request
    subscriber {
      id
      email
      status
      services {
        serviceName
        status
      }
    }
  }
}
```

### 3. Conditional Fields
```graphql
query GetWorkflow($workflowId: String!, $includeSteps: Boolean!) {
  workflow(workflowId: $workflowId) {
    workflowId
    status
    steps @include(if: $includeSteps) {
      stepName
      status
    }
  }
}
```

## Best Practices

### 1. Use Fragments for Reusability
```graphql
fragment WorkflowSummary on Workflow {
  workflowId
  status
  durationSeconds
  completedStepsCount
  totalStepsCount
}

query ListWorkflows {
  workflows {
    workflows {
      ...WorkflowSummary
    }
  }
}

query GetWorkflow($id: String!) {
  workflow(workflowId: $id) {
    ...WorkflowSummary
    steps {
      stepName
      status
    }
  }
}
```

### 2. Error Handling
```typescript
try {
  const result = await provisionSubscriber({ input });

  if (result.data.provisionSubscriber.isSuccessful) {
    // Success path
  } else {
    // Business logic failure (automatic rollback occurred)
    handleProvisioningFailure(result.data.provisionSubscriber.errorMessage);
  }
} catch (error) {
  // Network/GraphQL error
  handleNetworkError(error);
}
```

### 3. Polling for Progress
```typescript
const { data, startPolling, stopPolling } = useQuery(GET_WORKFLOW, {
  variables: { workflowId },
});

// Start polling when workflow is running
if (data?.workflow?.status === 'RUNNING') {
  startPolling(2000); // Every 2 seconds
}

// Stop when complete
if (data?.workflow?.isTerminal) {
  stopPolling();
}
```

## Performance Considerations

### Query Optimization
- Use field selection to request only needed data
- Avoid deep nesting when not needed
- Use pagination for workflow lists
- Implement DataLoader for batching (already done in customer queries)

### Caching
```typescript
// Apollo Client cache configuration
const cache = new InMemoryCache({
  typePolicies: {
    Workflow: {
      keyFields: ['workflowId'],
    },
    Query: {
      fields: {
        workflows: {
          keyArgs: ['filter', ['workflowType', 'status']],
          merge(existing, incoming) {
            // Merge pagination results
            return {
              ...incoming,
              workflows: [...(existing?.workflows || []), ...incoming.workflows],
            };
          },
        },
      },
    },
  },
});
```

## Future Enhancements

### Phase 2
- [ ] GraphQL Subscriptions for real-time workflow updates
- [ ] Nested subscriber queries from workflow results
- [ ] Batch provisioning mutation
- [ ] Workflow template queries

### Phase 3
- [ ] GraphQL Federation for microservices
- [ ] Advanced filtering with GraphQL directives
- [ ] Custom scalar types for workflow context
- [ ] GraphQL playground with authentication

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
**Maintainer:** Backend Team
