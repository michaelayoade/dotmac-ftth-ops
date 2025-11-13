/**
 * Field Service Management Types
 * Types for technicians, scheduling, time tracking, and resource management
 */

// ============================================================================
// Enums
// ============================================================================

export enum TechnicianStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ON_LEAVE = "on_leave",
  SICK = "sick",
  SUSPENDED = "suspended",
}

export enum SkillLevel {
  TRAINEE = "trainee",
  JUNIOR = "junior",
  INTERMEDIATE = "intermediate",
  SENIOR = "senior",
  EXPERT = "expert",
}

export enum ScheduleStatus {
  AVAILABLE = "available",
  ON_LEAVE = "on_leave",
  SICK = "sick",
  BUSY = "busy",
  OFF_DUTY = "off_duty",
}

export enum AssignmentStatus {
  SCHEDULED = "scheduled",
  CONFIRMED = "confirmed",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  RESCHEDULED = "rescheduled",
}

export enum TimeEntryType {
  REGULAR = "regular",
  OVERTIME = "overtime",
  BREAK = "break",
  TRAVEL = "travel",
  TRAINING = "training",
  ADMINISTRATIVE = "administrative",
}

export enum TimeEntryStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  INVOICED = "invoiced",
}

export enum EquipmentStatus {
  AVAILABLE = "available",
  IN_USE = "in_use",
  MAINTENANCE = "maintenance",
  REPAIR = "repair",
  RETIRED = "retired",
  LOST = "lost",
}

export enum VehicleStatus {
  AVAILABLE = "available",
  IN_USE = "in_use",
  MAINTENANCE = "maintenance",
  REPAIR = "repair",
  RETIRED = "retired",
}

export enum ResourceAssignmentStatus {
  RESERVED = "reserved",
  ASSIGNED = "assigned",
  IN_USE = "in_use",
  RETURNED = "returned",
  DAMAGED = "damaged",
  LOST = "lost",
}

// ============================================================================
// Technician Types
// ============================================================================

export interface Technician {
  id: string;
  tenantId: string;
  userId?: string;

  // Personal info
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  avatar?: string;

  // Employment
  status: TechnicianStatus;
  hireDate: string;
  terminationDate?: string;
  skillLevel: SkillLevel;
  hourlyRate?: number;

  // Skills and certifications
  skills: TechnicianSkill[];
  certifications: TechnicianCertification[];
  specializations: string[];

  // Location
  homeLocationLat?: number;
  homeLocationLng?: number;
  homeAddress?: string;
  currentLocationLat?: number;
  currentLocationLng?: number;
  lastLocationUpdate?: string;
  serviceAreas: string[];

  // Availability
  isAvailable: boolean;
  maxConcurrentTasks: number;

  // Performance
  completedTasks: number;
  averageRating?: number;
  completionRate?: number;
  averageResponseTimeMinutes?: number;

  // Audit
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface TechnicianSkill {
  skill: string;
  level: SkillLevel;
  yearsExperience?: number;
  certified: boolean;
  lastAssessed?: string;
}

export interface TechnicianCertification {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  certificateNumber?: string;
  certificateUrl?: string;
  isActive: boolean;
}

// ============================================================================
// Scheduling Types
// ============================================================================

export interface TechnicianSchedule {
  id: string;
  tenantId: string;
  technicianId: string;
  technician?: Technician;

  scheduleDate: string;
  shiftStart: string; // HH:MM
  shiftEnd: string; // HH:MM
  breakStart?: string;
  breakEnd?: string;

  status: ScheduleStatus;

  // Starting location
  startLocationLat?: number;
  startLocationLng?: number;
  startLocationName?: string;

  // Capacity
  maxTasks?: number;
  assignedTasksCount: number;

  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskAssignment {
  id: string;
  tenantId: string;

  // References
  taskId: string;
  technicianId: string;
  scheduleId?: string;

  // Related entities
  technician?: Technician;
  task?: {
    id: string;
    name: string;
    description?: string;
    projectId?: string;
  };

  // Scheduled times
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;

  // Travel
  travelTimeMinutes?: number;
  travelDistanceKm?: number;
  previousTaskId?: string;

  // Status
  status: AssignmentStatus;
  customerConfirmationRequired: boolean;
  customerConfirmedAt?: string;

  // Assignment details
  assignmentMethod?: "manual" | "auto" | "optimized";
  assignmentScore?: number;

  // Location
  taskLocationLat?: number;
  taskLocationLng?: number;
  taskLocationAddress?: string;

  // Reschedule
  originalScheduledStart?: string;
  rescheduleCount: number;
  rescheduleReason?: string;

  notes?: string;
  internalNotes?: string;

  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AssignmentCandidate {
  technicianId: string;
  technician: Technician;
  score: number;
  isAvailable: boolean;

  // Score breakdown
  skillMatchScore: number;
  locationScore: number;
  availabilityScore: number;
  workloadScore: number;
  certificationScore: number;

  // Details
  distanceKm?: number;
  travelTimeMinutes?: number;
  currentWorkload: number;
  missingSkills: string[];
  missingCertifications: string[];

  reasons: string[];
}

// ============================================================================
// Time Tracking Types
// ============================================================================

export interface TimeEntry {
  id: string;
  tenantId: string;

  // References
  technicianId: string;
  taskId?: string;
  projectId?: string;
  assignmentId?: string;

  // Related entities
  technician?: Technician;

  // Time tracking
  clockIn: string;
  clockOut?: string;
  breakDurationMinutes: number;

  // Entry details
  entryType: TimeEntryType;
  status: TimeEntryStatus;

  // Location
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;

  // Labor cost
  laborRateId?: string;
  hourlyRate?: number;
  totalHours?: number;
  totalCost?: number;

  // Approval
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;

  description?: string;
  notes?: string;

  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  // Computed
  isActive?: boolean;
  durationMinutes?: number;
}

export interface LaborRate {
  id: string;
  tenantId: string;

  name: string;
  description?: string;
  skillLevel?: SkillLevel;
  role?: string;

  // Rates
  regularRate: number;
  overtimeRate?: number;
  weekendRate?: number;
  holidayRate?: number;
  nightRate?: number;

  // Effective dates
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;

  currency: string;
  notes?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface TimesheetPeriod {
  id: string;
  tenantId: string;

  name: string;
  periodStart: string;
  periodEnd: string;

  status: "open" | "locked" | "approved" | "paid";
  lockedAt?: string;
  lockedBy?: string;

  // Summary
  totalHours?: number;
  totalCost?: number;
  technicianCount?: number;
  entryCount?: number;

  notes?: string;

  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// Resource Management Types
// ============================================================================

export interface Equipment {
  id: string;
  tenantId: string;

  // Identification
  name: string;
  category: string;
  equipmentType: string;
  serialNumber?: string;
  assetTag?: string;
  barcode?: string;

  // Specs
  manufacturer?: string;
  model?: string;
  specifications?: Record<string, any>;

  // Status
  status: EquipmentStatus;
  condition?: string;
  conditionNotes?: string;

  // Location
  currentLocation?: string;
  homeLocation?: string;
  assignedToTechnicianId?: string;
  assignedTechnician?: Technician;

  // Lifecycle
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpires?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;

  // Calibration
  requiresCalibration: boolean;
  lastCalibrationDate?: string;
  nextCalibrationDue?: string;
  calibrationCertificate?: string;

  // Rental
  isRental: boolean;
  rentalCostPerDay?: number;
  rentalVendor?: string;

  // Availability
  isActive: boolean;
  isShareable: boolean;

  description?: string;
  notes?: string;

  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Vehicle {
  id: string;
  tenantId: string;

  // Identification
  name: string;
  vehicleType: string;
  make: string;
  model: string;
  year?: number;
  color?: string;

  // Registration
  licensePlate: string;
  vin?: string;
  registrationNumber?: string;
  registrationExpires?: string;

  // Status
  status: VehicleStatus;
  condition?: string;
  odometerReading?: number;

  // Assignment
  assignedToTechnicianId?: string;
  assignedTechnician?: Technician;
  homeLocation?: string;

  // GPS
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;

  // Maintenance
  lastServiceDate?: string;
  nextServiceDue?: string;
  lastServiceOdometer?: number;
  nextServiceOdometer?: number;

  // Insurance
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpires?: string;

  // Fuel
  fuelType?: string;
  fuelCardNumber?: string;
  averageFuelConsumption?: number;

  // Capacity
  seatingCapacity?: number;
  cargoCapacity?: string;

  // Lifecycle
  purchaseDate?: string;
  purchaseCost?: number;
  isLeased: boolean;
  leaseExpires?: string;

  isActive: boolean;
  description?: string;
  notes?: string;

  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ResourceAssignment {
  id: string;
  tenantId: string;

  // Assignment target
  technicianId: string;
  taskId?: string;
  projectId?: string;

  // Related entities
  technician?: Technician;

  // Resource
  equipmentId?: string;
  vehicleId?: string;
  equipment?: Equipment;
  vehicle?: Vehicle;

  // Period
  assignedAt: string;
  expectedReturnAt?: string;
  returnedAt?: string;

  status: ResourceAssignmentStatus;

  // Condition
  conditionAtAssignment?: string;
  conditionAtReturn?: string;
  damageDescription?: string;
  damageCost?: number;

  assignmentNotes?: string;
  returnNotes?: string;

  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  // Computed
  isActive?: boolean;
  isOverdue?: boolean;
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface ClockInData {
  technicianId: string;
  taskId?: string;
  projectId?: string;
  entryType: TimeEntryType;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface ClockOutData {
  breakDurationMinutes?: number;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface CreateAssignmentData {
  taskId: string;
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
  customerConfirmationRequired?: boolean;
  notes?: string;
}

export interface AutoAssignmentData {
  taskId: string;
  scheduledStart: string;
  scheduledEnd: string;
  requiredSkills?: Record<string, boolean>;
  requiredCertifications?: string[];
  taskLocationLat?: number;
  taskLocationLng?: number;
  maxCandidates?: number;
}

export interface CreateScheduleData {
  technicianId: string;
  scheduleDate: string;
  shiftStart: string;
  shiftEnd: string;
  breakStart?: string;
  breakEnd?: string;
  status: ScheduleStatus;
  startLocationLat?: number;
  startLocationLng?: number;
  startLocationName?: string;
  maxTasks?: number;
  notes?: string;
}

export interface AssignResourceData {
  technicianId: string;
  equipmentId?: string;
  vehicleId?: string;
  taskId?: string;
  projectId?: string;
  expectedReturnAt?: string;
  conditionAtAssignment?: string;
  assignmentNotes?: string;
}

export interface ReturnResourceData {
  conditionAtReturn?: string;
  damageDescription?: string;
  damageCost?: number;
  returnNotes?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface TechnicianFilter {
  status?: TechnicianStatus[] | undefined;
  skillLevel?: SkillLevel[] | undefined;
  skills?: string[] | undefined;
  certifications?: string[] | undefined;
  serviceAreas?: string[] | undefined;
  isAvailable?: boolean | undefined;
  search?: string | undefined;
}

export interface ScheduleFilter {
  technicianId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  status?: ScheduleStatus[] | undefined;
}

export interface AssignmentFilter {
  technicianId?: string | undefined;
  taskId?: string | undefined;
  status?: AssignmentStatus[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface TimeEntryFilter {
  technicianId?: string | undefined;
  status?: TimeEntryStatus[] | undefined;
  entryType?: TimeEntryType[] | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  projectId?: string | undefined;
}

export interface ResourceFilter {
  status?: (EquipmentStatus | VehicleStatus)[] | undefined;
  category?: string[] | undefined;
  assignedToTechnicianId?: string | undefined;
  isAvailable?: boolean | undefined;
  search?: string | undefined;
}

// ============================================================================
// Response Types
// ============================================================================

export interface TechnicianListResponse {
  technicians: Technician[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ScheduleListResponse {
  schedules: TechnicianSchedule[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssignmentListResponse {
  assignments: TaskAssignment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TimeEntryListResponse {
  entries: TimeEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EquipmentListResponse {
  equipment: Equipment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssignmentCandidatesResponse {
  candidates: AssignmentCandidate[];
  total: number;
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface TechnicianMetrics {
  totalTechnicians: number;
  activeTechnicians: number;
  availableTechnicians: number;
  averageUtilization: number;
  totalTasksCompleted: number;
  averageCompletionTime: number;
}

export interface TimeTrackingMetrics {
  totalHours: number;
  totalCost: number;
  regularHours: number;
  overtimeHours: number;
  averageHoursPerTechnician: number;
  totalBreakHours: number;
}

export interface ResourceMetrics {
  totalEquipment: number;
  availableEquipment: number;
  equipmentInUse: number;
  equipmentInMaintenance: number;
  totalVehicles: number;
  availableVehicles: number;
  vehiclesInUse: number;
  vehiclesInMaintenance: number;
}
