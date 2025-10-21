# Fiber Infrastructure API Documentation

## Overview

The Fiber Infrastructure Management System provides comprehensive REST API and GraphQL interfaces for managing fiber optic network infrastructure including cables, distribution points, service areas, splice points, health metrics, and OTDR test results.

**Implementation Status**: ✅ **COMPLETE** (Phases 1-4)
- Database Layer: 100% Complete
- Service Layer: 100% Complete
- REST API: 100% Complete
- GraphQL API: 100% Complete

---

## Table of Contents

1. [Database Models](#database-models)
2. [REST API Endpoints](#rest-api-endpoints)
3. [GraphQL Queries](#graphql-queries)
4. [Service Layer Methods](#service-layer-methods)
5. [Usage Examples](#usage-examples)
6. [Enum Reference](#enum-reference)

---

## Database Models

### 1. Fiber Cable (`fiber_cables`)

Tracks fiber optic cables in the network.

**Fields**:
- `id` (UUID): Primary key
- `cable_id` (String, 50, unique per tenant): External cable identifier
- `name` (String, 200, nullable): Friendly name
- `fiber_type` (Enum): SINGLE_MODE | MULTI_MODE
- `fiber_count` (Integer): Number of fiber strands
- `status` (Enum): ACTIVE | INACTIVE | UNDER_CONSTRUCTION | MAINTENANCE | DAMAGED | RETIRED
- `installation_type` (Enum): AERIAL | UNDERGROUND | DUCT | DIRECT_BURIAL
- `start_site_id` (String, 50): Starting location
- `end_site_id` (String, 50): Ending location
- `length_km` (Float): Cable length in kilometers
- `route_geojson` (JSONB): GeoJSON LineString of cable route
- `manufacturer` (String, 100): Cable manufacturer
- `model` (String, 100): Cable model
- `installation_date` (DateTime): Installation date
- `warranty_expiry_date` (DateTime): Warranty expiration
- `attenuation_db_per_km` (Float): Signal loss per km
- `max_capacity` (Integer): Maximum supported services
- `notes` (Text): Additional notes
- Standard audit fields (tenant_id, created_at, updated_at, created_by, updated_by)

**Indexes**:
- Unique: (tenant_id, cable_id)
- Non-unique: tenant_id, status, fiber_type, installation_type, start_site_id, end_site_id

### 2. Distribution Point (`fiber_distribution_points`)

Network distribution cabinets, closures, and connection points.

**Fields**:
- `id` (UUID): Primary key
- `point_id` (String, 50, unique per tenant): External point identifier
- `point_type` (Enum): FDH | FDT | FAT | SPLITTER | PATCH_PANEL
- `name` (String, 200): Friendly name
- `status` (Enum): ACTIVE | INACTIVE | UNDER_CONSTRUCTION | MAINTENANCE | DAMAGED | RETIRED
- `site_id` (String, 50): Site location
- `location_geojson` (JSONB): GeoJSON Point of location
- `address` (String, 500): Physical address
- `total_ports` (Integer): Total available ports
- `used_ports` (Integer, default 0): Ports in use
- `manufacturer` (String, 100)
- `model` (String, 100)
- `installation_date` (DateTime)
- `notes` (Text)
- Standard audit fields

**Indexes**:
- Unique: (tenant_id, point_id)
- Non-unique: tenant_id, point_type, status, site_id

### 3. Service Area (`fiber_service_areas`)

Geographic coverage areas for fiber service.

**Fields**:
- `id` (UUID): Primary key
- `area_id` (String, 50, unique per tenant): External area identifier
- `name` (String, 200): Area name
- `area_type` (Enum): RESIDENTIAL | COMMERCIAL | INDUSTRIAL | MIXED
- `is_serviceable` (Boolean, default False): Can service be provided
- `coverage_geojson` (JSONB): GeoJSON Polygon of coverage area
- `postal_codes` (Array[String]): List of postal codes
- `construction_status` (String, 50): Construction phase
- `go_live_date` (DateTime): Service availability date
- `homes_passed` (Integer, default 0): Residences with fiber access
- `homes_connected` (Integer, default 0): Active residential connections
- `businesses_passed` (Integer, default 0): Businesses with fiber access
- `businesses_connected` (Integer, default 0): Active business connections
- `notes` (Text)
- Standard audit fields

**Indexes**:
- Unique: (tenant_id, area_id)
- Non-unique: tenant_id, area_type, is_serviceable

### 4. Splice Point (`fiber_splice_points`)

Fiber splice locations and quality metrics.

**Fields**:
- `id` (UUID): Primary key
- `splice_id` (String, 50, unique per tenant): External splice identifier
- `cable_id` (UUID, FK to fiber_cables): Associated cable
- `distribution_point_id` (UUID, FK to fiber_distribution_points, nullable): Associated distribution point
- `status` (Enum): ACTIVE | INACTIVE | DEGRADED | FAILED
- `splice_type` (String, 50): Splice type (fusion, mechanical)
- `location_geojson` (JSONB): GeoJSON Point of splice location
- `enclosure_type` (String, 50): Enclosure type
- `insertion_loss_db` (Float): Splice insertion loss
- `return_loss_db` (Float): Splice return loss
- `last_test_date` (DateTime): Last test date
- `notes` (Text)
- Standard audit fields

**Indexes**:
- Unique: (tenant_id, splice_id)
- Non-unique: tenant_id, cable_id, distribution_point_id, status

### 5. Fiber Health Metric (`fiber_health_metrics`)

Cable health monitoring and diagnostics.

**Fields**:
- `id` (UUID): Primary key
- `cable_id` (UUID, FK to fiber_cables): Associated cable
- `measured_at` (DateTime, default now): Measurement timestamp
- `health_status` (Enum): EXCELLENT | GOOD | FAIR | DEGRADED | CRITICAL
- `health_score` (Float, 0-100): Overall health score
- `total_loss_db` (Float): Total signal loss
- `splice_loss_db` (Float): Loss from splices
- `connector_loss_db` (Float): Loss from connectors
- `detected_issues` (JSONB): Array of detected issues
- `recommendations` (Array[String]): Recommended actions
- Standard audit fields

**Indexes**:
- Non-unique: tenant_id, cable_id, measured_at, health_status

### 6. OTDR Test Result (`fiber_otdr_test_results`)

Optical Time Domain Reflectometer test results.

**Fields**:
- `id` (UUID): Primary key
- `cable_id` (UUID, FK to fiber_cables): Associated cable
- `strand_id` (Integer): Fiber strand number
- `test_date` (DateTime, default now): Test timestamp
- `wavelength_nm` (Integer): Test wavelength (e.g., 1310, 1550)
- `pulse_width_ns` (Integer): Pulse width in nanoseconds
- `total_loss_db` (Float): Total measured loss
- `length_km` (Float): Measured cable length
- `events_detected` (Integer, default 0): Number of events detected
- `events` (JSONB): Array of event details
- `pass_fail` (Boolean): Test result
- `tester_id` (String, 50): Technician identifier
- `notes` (Text)
- Standard audit fields

**Indexes**:
- Non-unique: tenant_id, cable_id, strand_id, test_date

---

## REST API Endpoints

Base URL: `/api/v1/fiber`

Authentication: Required (Bearer token)

### Fiber Cables

#### 1. Create Fiber Cable
```http
POST /api/v1/fiber/cables
Content-Type: application/json
Authorization: Bearer <token>

{
  "cable_id": "FC-001",
  "name": "Main Trunk Line A",
  "fiber_type": "single_mode",
  "fiber_count": 144,
  "installation_type": "underground",
  "start_site_id": "SITE-001",
  "end_site_id": "SITE-002",
  "length_km": 5.2,
  "manufacturer": "Corning",
  "model": "SMF-28"
}
```

**Response**: 201 Created
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cable_id": "FC-001",
  "name": "Main Trunk Line A",
  "fiber_type": "single_mode",
  "fiber_count": 144,
  "status": "under_construction",
  "installation_type": "underground",
  "start_site_id": "SITE-001",
  "end_site_id": "SITE-002",
  "length_km": 5.2,
  "manufacturer": "Corning",
  "model": "SMF-28",
  "created_at": "2025-10-20T02:00:00Z",
  "updated_at": "2025-10-20T02:00:00Z",
  "tenant_id": "demo-alpha"
}
```

#### 2. List Fiber Cables
```http
GET /api/v1/fiber/cables?status=active&fiber_type=single_mode&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters**:
- `status` (optional): Filter by cable status
- `fiber_type` (optional): Filter by fiber type
- `installation_type` (optional): Filter by installation method
- `start_site_id` (optional): Filter by start site
- `end_site_id` (optional): Filter by end site
- `limit` (optional, default 100): Results per page
- `offset` (optional, default 0): Pagination offset

**Response**: 200 OK (Array)

#### 3. Get Fiber Cable
```http
GET /api/v1/fiber/cables/{cable_id}
Authorization: Bearer <token>
```

**Response**: 200 OK (Single object) or 404 Not Found

#### 4. Update Fiber Cable
```http
PATCH /api/v1/fiber/cables/{cable_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "active",
  "attenuation_db_per_km": 0.35
}
```

**Response**: 200 OK (Updated object)

#### 5. Activate Fiber Cable
```http
POST /api/v1/fiber/cables/{cable_id}/activate
Authorization: Bearer <token>
```

**Response**: 200 OK

#### 6. Delete Fiber Cable
```http
DELETE /api/v1/fiber/cables/{cable_id}
Authorization: Bearer <token>
```

**Response**: 204 No Content

### Distribution Points

#### 7. Create Distribution Point
```http
POST /api/v1/fiber/distribution-points
Content-Type: application/json

{
  "point_id": "DP-001",
  "point_type": "FDH",
  "name": "Main Street Cabinet",
  "site_id": "SITE-MAIN",
  "total_ports": 96,
  "used_ports": 48
}
```

**Response**: 201 Created

#### 8. List Distribution Points
```http
GET /api/v1/fiber/distribution-points?point_type=FDH&limit=50
```

**Query Parameters**:
- `point_type`: Filter by type (FDH, FDT, FAT, SPLITTER, PATCH_PANEL)
- `status`: Filter by status
- `site_id`: Filter by site
- `near_capacity`: Filter points >80% capacity (boolean)
- `limit`, `offset`: Pagination

**Response**: 200 OK (Array)

#### 9. Get Distribution Point
```http
GET /api/v1/fiber/distribution-points/{point_id}
```

**Response**: 200 OK

#### 10. Get Port Utilization
```http
GET /api/v1/fiber/distribution-points/{point_id}/utilization
```

**Response**: 200 OK
```json
{
  "point_id": "DP-001",
  "total_ports": 96,
  "used_ports": 48,
  "available_ports": 48,
  "utilization_percentage": 50.0,
  "is_full": false,
  "is_near_capacity": false
}
```

### Service Areas

#### 11. Create Service Area
```http
POST /api/v1/fiber/service-areas
Content-Type: application/json

{
  "area_id": "SA-001",
  "name": "Downtown Business District",
  "area_type": "commercial",
  "is_serviceable": true,
  "postal_codes": ["12345", "12346"],
  "homes_passed": 500,
  "homes_connected": 350
}
```

**Response**: 201 Created

#### 12. List Service Areas
```http
GET /api/v1/fiber/service-areas?area_type=residential&is_serviceable=true
```

**Query Parameters**:
- `area_type`: Filter by type (residential, commercial, industrial, mixed)
- `is_serviceable`: Filter by serviceability (boolean)
- `construction_status`: Filter by construction status
- `limit`, `offset`: Pagination

**Response**: 200 OK (Array)

#### 13. Get Service Area Statistics
```http
GET /api/v1/fiber/service-areas/{area_id}/statistics
```

**Response**: 200 OK
```json
{
  "area_id": "SA-001",
  "area_name": "Downtown Business District",
  "area_type": "commercial",
  "is_serviceable": true,
  "residential": {
    "passed": 500,
    "connected": 350,
    "penetration_rate": 70.0
  },
  "commercial": {
    "passed": 50,
    "connected": 42,
    "penetration_rate": 84.0
  },
  "total": {
    "passed": 550,
    "connected": 392,
    "penetration_rate": 71.3
  }
}
```

### Health Metrics & OTDR Tests

#### 14. Record Health Metric
```http
POST /api/v1/fiber/health-metrics
Content-Type: application/json

{
  "cable_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "health_status": "good",
  "health_score": 85.5,
  "total_loss_db": 3.2,
  "splice_loss_db": 0.8,
  "connector_loss_db": 0.5
}
```

**Response**: 201 Created

#### 15. List Health Metrics
```http
GET /api/v1/fiber/health-metrics?cable_id={cable_id}&health_status=good
```

**Response**: 200 OK (Array)

#### 16. Record OTDR Test
```http
POST /api/v1/fiber/otdr-tests
Content-Type: application/json

{
  "cable_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "strand_id": 12,
  "wavelength_nm": 1550,
  "pulse_width_ns": 100,
  "total_loss_db": 4.2,
  "length_km": 5.18,
  "events_detected": 3,
  "pass_fail": true
}
```

**Response**: 201 Created

#### 17. List OTDR Tests
```http
GET /api/v1/fiber/otdr-tests?cable_id={cable_id}&strand_id=12&limit=10
```

**Response**: 200 OK (Array)

### Analytics

#### 18. Network Health Summary
```http
GET /api/v1/fiber/analytics/network-health
```

**Response**: 200 OK
```json
{
  "total_cables": 150,
  "cables_by_status": {
    "active": 120,
    "inactive": 15,
    "under_construction": 10,
    "maintenance": 5
  },
  "health_by_status": {
    "excellent": 50,
    "good": 60,
    "fair": 20,
    "degraded": 15,
    "critical": 5
  }
}
```

#### 19. Capacity Planning Data
```http
GET /api/v1/fiber/analytics/capacity-planning
```

**Response**: 200 OK
```json
{
  "total_distribution_points": 45,
  "total_ports": 4320,
  "used_ports": 2590,
  "available_ports": 1730,
  "utilization_percentage": 59.95,
  "points_near_capacity": 5,
  "near_capacity_points": [...]
}
```

#### 20. Coverage Summary
```http
GET /api/v1/fiber/analytics/coverage-summary
```

**Response**: 200 OK
```json
{
  "total_service_areas": 25,
  "serviceable_areas": 20,
  "residential": {
    "passed": 15000,
    "connected": 9500,
    "penetration_rate": 63.33
  },
  "commercial": {
    "passed": 850,
    "connected": 620,
    "penetration_rate": 72.94
  }
}
```

---

## GraphQL Queries

GraphQL Endpoint: `/api/v1/graphql`

### Fiber Cable Queries

#### 1. List Fiber Cables with Filters
```graphql
query {
  fiberCables(
    limit: 50,
    offset: 0,
    status: ACTIVE,
    fiberType: SINGLE_MODE,
    search: "trunk"
  ) {
    cables {
      id
      cableId
      name
      fiberType
      fiberCount
      status
      installationType
      startPointId
      endPointId
      lengthKm
      manufacturer
      model
      createdAt
    }
    totalCount
    hasNextPage
  }
}
```

#### 2. Get Single Fiber Cable
```graphql
query {
  fiberCable(id: "FC-001") {
    id
    cableId
    name
    fiberType
    fiberCount
    status
    lengthKm
    attenuationDbPerKm
    maxCapacity
    spliceCount
    healthStatus
    lastTestedAt
  }
}
```

#### 3. Get Cables by Route
```graphql
query {
  fiberCablesByRoute(
    startPointId: "SITE-001",
    endPointId: "SITE-002"
  ) {
    id
    cableId
    name
    lengthKm
    status
  }
}
```

#### 4. Get Cables by Distribution Point
```graphql
query {
  fiberCablesByDistributionPoint(distributionPointId: "DP-001") {
    id
    cableId
    name
    fiberCount
  }
}
```

### Distribution Point Queries

#### 5. List Distribution Points
```graphql
query {
  distributionPoints(
    limit: 50,
    pointType: FDH,
    nearCapacity: true
  ) {
    distributionPoints {
      id
      pointId
      pointType
      name
      totalPorts
      usedPorts
      availablePorts
      capacityUtilizationPercent
      isNearCapacity
    }
    totalCount
    hasNextPage
  }
}
```

#### 6. Get Distribution Point by Site
```graphql
query {
  distributionPointsBySite(siteId: "SITE-MAIN") {
    id
    pointId
    name
    totalPorts
    usedPorts
  }
}
```

### Service Area Queries

#### 7. List Service Areas
```graphql
query {
  serviceAreas(
    limit: 50,
    areaType: RESIDENTIAL,
    isServiceable: true
  ) {
    serviceAreas {
      id
      areaId
      name
      areaType
      isServiceable
      homesPassed
      homesConnected
      homesPenetrationPercent
      overallPenetrationPercent
    }
    totalCount
    hasNextPage
  }
}
```

#### 8. Get Service Areas by Postal Code
```graphql
query {
  serviceAreasByPostalCode(postalCode: "12345") {
    id
    areaId
    name
    isServiceable
    homesPassed
    homesConnected
  }
}
```

### Analytics Queries

#### 9. Network Analytics
```graphql
query {
  fiberNetworkAnalytics {
    totalFiberKm
    totalCables
    totalStrands
    totalDistributionPoints
    totalSplicePoints
    totalCapacity
    usedCapacity
    availableCapacity
    capacityUtilizationPercent
    healthyCables
    degradedCables
    failedCables
    networkHealthScore
    totalServiceAreas
    activeServiceAreas
    homesPassed
    homesConnected
    penetrationRatePercent
    averageCableLossDbPerKm
    averageSpliceLossDb
    generatedAt
  }
}
```

#### 10. Fiber Dashboard
```graphql
query {
  fiberDashboard {
    analytics {
      totalCables
      networkHealthScore
      penetrationRatePercent
    }
    topCablesByUtilization {
      id
      cableId
      name
    }
    cablesRequiringAttention {
      id
      cableId
      reason
    }
    generatedAt
  }
}
```

---

## Service Layer Methods

The `FiberService` class provides 31 methods across 7 categories:

### Fiber Cable Methods (7)
- `create_cable()`: Create new fiber cable
- `get_cable()`: Get cable by ID or cable_id
- `list_cables()`: List cables with filters
- `update_cable()`: Update cable fields
- `delete_cable()`: Soft-delete cable
- `activate_cable()`: Change status to ACTIVE
- `count_cables()`: Get total count with filters

### Distribution Point Methods (6)
- `create_distribution_point()`: Create new distribution point
- `get_distribution_point()`: Get point by ID or point_id
- `list_distribution_points()`: List points with filters
- `update_distribution_point()`: Update point fields
- `get_port_utilization()`: Calculate port utilization stats
- `count_distribution_points()`: Get total count

### Service Area Methods (5)
- `create_service_area()`: Create new service area
- `get_service_area()`: Get area by ID or area_id
- `list_service_areas()`: List areas with filters
- `update_service_area()`: Update area fields
- `get_coverage_statistics()`: Calculate coverage metrics

### Splice Point Methods (4)
- `create_splice_point()`: Create new splice point
- `get_splice_point()`: Get splice by ID or splice_id
- `list_splice_points()`: List splices with filters
- `update_splice_point()`: Update splice fields

### Health Metrics Methods (3)
- `record_health_metric()`: Record new health measurement
- `get_latest_health_metric()`: Get most recent metric for cable
- `list_health_metrics()`: List metrics with filters

### OTDR Test Methods (3)
- `record_otdr_test()`: Record new OTDR test
- `get_latest_otdr_test()`: Get most recent test for cable/strand
- `list_otdr_tests()`: List tests with filters

### Analytics Methods (3)
- `get_network_health_summary()`: Aggregate health statistics
- `get_capacity_planning_data()`: Port utilization across network
- `get_coverage_summary()`: Service area penetration metrics

---

## Usage Examples

### Example 1: Complete Cable Lifecycle

```python
from dotmac.platform.fiber import FiberService
from dotmac.platform.fiber.models import FiberType, CableInstallationType

# Initialize service
fiber_service = FiberService(db=db_session, tenant_id="demo-alpha")

# 1. Create cable
cable = fiber_service.create_cable(
    cable_id="FC-TRUNK-001",
    name="Main Trunk Line",
    fiber_type=FiberType.SINGLE_MODE,
    fiber_count=144,
    installation_type=CableInstallationType.UNDERGROUND,
    start_site_id="SITE-A",
    end_site_id="SITE-B",
    length_km=8.5,
    manufacturer="Corning",
    created_by="tech@example.com"
)

# 2. Record OTDR test
test = fiber_service.record_otdr_test(
    cable_id=cable.id,
    strand_id=1,
    wavelength_nm=1550,
    total_loss_db=3.2,
    length_km=8.48,
    pass_fail=True,
    created_by="tech@example.com"
)

# 3. Record health metric
metric = fiber_service.record_health_metric(
    cable_id=cable.id,
    health_status=FiberHealthStatus.GOOD,
    health_score=88.5,
    total_loss_db=3.2,
    created_by="system"
)

# 4. Activate cable
fiber_service.activate_cable(cable_id=cable.id)

# 5. Get cable with latest metrics
updated_cable = fiber_service.get_cable(cable.id, include_relations=True)
```

### Example 2: Network Analytics

```python
# Get comprehensive network statistics
analytics = fiber_service.get_network_health_summary()
print(f"Total cables: {analytics['total_cables']}")
print(f"Active cables: {analytics['cables_by_status']['active']}")

# Get capacity planning data
capacity = fiber_service.get_capacity_planning_data()
print(f"Network utilization: {capacity['utilization_percentage']:.1f}%")
print(f"Points near capacity: {capacity['points_near_capacity']}")

# Get coverage summary
coverage = fiber_service.get_coverage_summary()
print(f"Homes passed: {coverage['residential']['homes_passed']}")
print(f"Penetration rate: {coverage['residential']['penetration_rate']:.1f}%")
```

### Example 3: GraphQL Query

```graphql
query NetworkOverview {
  # Get network analytics
  analytics: fiberNetworkAnalytics {
    totalCables
    totalFiberKm
    networkHealthScore
    capacityUtilizationPercent
    penetrationRatePercent
  }

  # Get cables requiring attention
  cables: fiberCables(status: DEGRADED, limit: 10) {
    cables {
      id
      cableId
      name
      healthStatus
      lastTestedAt
    }
  }

  # Get distribution points near capacity
  distributionPoints(nearCapacity: true, limit: 10) {
    distributionPoints {
      id
      pointId
      name
      capacityUtilizationPercent
      totalPorts
      usedPorts
    }
  }
}
```

---

## Enum Reference

### FiberType
- `SINGLE_MODE`: Single-mode fiber (long distance, high bandwidth)
- `MULTI_MODE`: Multi-mode fiber (short distance, lower cost)

### FiberCableStatus
- `ACTIVE`: Cable is operational
- `INACTIVE`: Cable is installed but not in use
- `UNDER_CONSTRUCTION`: Cable is being installed
- `MAINTENANCE`: Cable is under maintenance
- `DAMAGED`: Cable has damage
- `RETIRED`: Cable is decommissioned

### CableInstallationType
- `AERIAL`: Mounted on poles
- `UNDERGROUND`: In conduit underground
- `DUCT`: In duct system
- `DIRECT_BURIAL`: Buried directly in ground

### DistributionPointType
- `FDH`: Fiber Distribution Hub
- `FDT`: Fiber Distribution Terminal
- `FAT`: Fiber Access Terminal
- `SPLITTER`: Optical splitter
- `PATCH_PANEL`: Fiber patch panel

### ServiceAreaType
- `RESIDENTIAL`: Residential areas
- `COMMERCIAL`: Business districts
- `INDUSTRIAL`: Industrial zones
- `MIXED`: Mixed-use areas

### SpliceStatus
- `ACTIVE`: Splice is operational
- `INACTIVE`: Splice is not in use
- `DEGRADED`: Splice has high loss
- `FAILED`: Splice has failed

### FiberHealthStatus
- `EXCELLENT`: Health score ≥95%
- `GOOD`: Health score ≥80%
- `FAIR`: Health score ≥65%
- `DEGRADED`: Health score ≥50%
- `CRITICAL`: Health score <50%

---

## Error Responses

All API endpoints return standard HTTP status codes:

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `204 No Content`: Resource deleted successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Example error response:
```json
{
  "detail": "Fiber cable with id 'FC-999' not found"
}
```

---

## Rate Limiting

API endpoints are subject to rate limiting:
- Default: 1000 requests per hour per tenant
- GraphQL: 500 requests per hour per tenant
- Analytics endpoints: 100 requests per hour per tenant

---

## Pagination

List endpoints support pagination:
- `limit`: Results per page (default 100, max 500)
- `offset`: Number of results to skip (default 0)

Response includes:
- Total count of results
- Current page data
- Indication if more pages exist

---

## Multi-Tenancy

All data is automatically scoped to the authenticated user's tenant. Cross-tenant access is not permitted. The `tenant_id` field is automatically set from the authentication context and cannot be modified.

---

## Audit Trail

All create and update operations automatically track:
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update
- `created_by`: Email of user who created the record
- `updated_by`: Email of user who last updated the record

---

## Soft Delete

Delete operations are soft deletes - records are marked as deleted but not removed from the database. Soft-deleted records are automatically filtered from query results.

---

## End of Documentation

For additional support or questions, please contact the platform team or refer to the inline code documentation in:
- `/src/dotmac/platform/fiber/models.py` - Database models
- `/src/dotmac/platform/fiber/service.py` - Service layer
- `/src/dotmac/platform/fiber/router.py` - REST API endpoints
- `/src/dotmac/platform/graphql/queries/fiber.py` - GraphQL queries
