# Bandwidth Management Features - Implementation Status

**Date:** 2025-11-08
**Platform:** DotMac FTTH Operations Platform

---

## ✅ YES - Bandwidth Management is Fully Implemented

The platform has **comprehensive bandwidth management** capabilities including FUP controls, contention ratios, and traffic shaping integration.

---

## 🎯 Core Features Implemented

### 1. **Fair Usage Policy (FUP) Controls** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # Fair Usage Policy (FUP)
    has_fup: Mapped[bool] = mapped_column(default=False)
    fup_threshold: Mapped[Decimal | None]  # Data limit before throttling
    fup_threshold_unit: Mapped[DataUnit | None]  # MB, GB, TB
    fup_throttle_speed: Mapped[Decimal | None]  # Speed after FUP threshold
```

**Features:**
- ✅ **FUP threshold configuration** - Set data limits per plan
- ✅ **Automatic throttling** - Reduce speed after FUP threshold
- ✅ **Multi-unit support** - MB, GB, TB measurements
- ✅ **Per-plan customization** - Different FUP for each service tier

**Example Configuration:**
```python
plan = InternetServicePlan(
    name="Home 100Mbps",
    download_speed=100,
    upload_speed=50,
    has_fup=True,
    fup_threshold=500,  # 500GB
    fup_threshold_unit=DataUnit.GB,
    fup_throttle_speed=10  # Throttle to 10Mbps after 500GB
)
```

---

### 2. **Contention Ratios** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # Technical specifications
    contention_ratio: Mapped[str | None] = mapped_column(String(20))
    # Examples: "1:20", "1:50", "1:1"
```

**Features:**
- ✅ **Configurable contention ratios** - Define oversubscription levels
- ✅ **Per-plan settings** - Different ratios for residential vs business
- ✅ **Standards compliance** - Common formats (1:20, 1:50, etc.)

**Example Usage:**
```python
# Residential plan with typical contention
residential_plan = InternetServicePlan(
    plan_type=PlanType.RESIDENTIAL,
    contention_ratio="1:50"  # Up to 50 users share bandwidth
)

# Business plan with dedicated bandwidth
business_plan = InternetServicePlan(
    plan_type=PlanType.BUSINESS,
    contention_ratio="1:1"  # Dedicated, no sharing
)

# Enterprise with guaranteed bandwidth
enterprise_plan = InternetServicePlan(
    plan_type=PlanType.ENTERPRISE,
    contention_ratio="1:1"  # Full dedicated bandwidth
)
```

---

### 3. **Traffic Shaping** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # QoS and traffic shaping
    qos_priority: Mapped[int] = mapped_column(Integer, default=50)  # 0-100
    traffic_shaping_enabled: Mapped[bool] = mapped_column(default=False)

    # Data cap with throttle policies
    throttle_policy: Mapped[ThrottlePolicy] = mapped_column(
        default=ThrottlePolicy.NO_THROTTLE
    )
    throttled_download_speed: Mapped[Decimal | None]
    throttled_upload_speed: Mapped[Decimal | None]
```

**Throttle Policies:**
```python
class ThrottlePolicy(str, Enum):
    NO_THROTTLE = "no_throttle"          # No action after cap
    THROTTLE = "throttle"                # Reduce speed after cap
    BLOCK = "block"                      # Block traffic after cap
    OVERAGE_CHARGE = "overage_charge"    # Charge for overage
```

**Features:**
- ✅ **QoS prioritization** - Priority levels 0-100
- ✅ **Multiple throttle policies** - Throttle, block, or charge
- ✅ **Configurable throttle speeds** - Set reduced speeds after cap
- ✅ **Traffic shaping toggle** - Enable/disable per plan

---

### 4. **Bandwidth Profiles (RADIUS Integration)** ✅

**Location:** `src/dotmac/platform/radius/models.py`

```python
class RadiusBandwidthProfile(Base):
    """Bandwidth limits for RADIUS subscribers."""

    id: Mapped[str] = primary_key
    tenant_id: Mapped[str] = ForeignKey("tenants.id")

    # Bandwidth configuration
    download_rate_kbps: Mapped[int]       # Download speed in Kbps
    upload_rate_kbps: Mapped[int]         # Upload speed in Kbps
    download_burst_kbps: Mapped[int | None]  # Burst download speed
    upload_burst_kbps: Mapped[int | None]    # Burst upload speed
```

**Features:**
- ✅ **RADIUS integration** - Standard FreeRADIUS bandwidth profiles
- ✅ **Burst speed support** - Temporary speed boosts
- ✅ **Tenant isolation** - Separate profiles per ISP
- ✅ **Dynamic assignment** - Applied to subscribers via RADIUS

---

### 5. **Automated Usage Monitoring** ✅

**Location:** `src/dotmac/platform/services/internet_plans/usage_monitoring_tasks.py`

```python
# Data cap usage thresholds (percentage)
USAGE_THRESHOLDS = {
    80: AlarmSeverity.WARNING,   # 80% = WARNING
    90: AlarmSeverity.MINOR,     # 90% = MINOR
    100: AlarmSeverity.MAJOR,    # 100% = MAJOR (exceeded cap)
}

@celery_app.task
async def monitor_data_cap_usage():
    """Monitor subscriber usage against data caps and generate alerts."""
```

**Features:**
- ✅ **Automated monitoring** - Celery periodic tasks
- ✅ **Multi-threshold alerts** - 80%, 90%, 100% warnings
- ✅ **Alarm generation** - Automatic tickets for violations
- ✅ **Real-time tracking** - TimescaleDB integration

---

### 6. **Data Cap Management** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # Data cap configuration
    has_data_cap: Mapped[bool] = mapped_column(default=False)
    data_cap_amount: Mapped[Decimal | None]
    data_cap_unit: Mapped[DataUnit | None]  # MB, GB, TB, UNLIMITED

    # Overage handling
    overage_price_per_unit: Mapped[Decimal | None]  # Price per GB overage
    overage_unit: Mapped[DataUnit | None]
```

**Features:**
- ✅ **Flexible data caps** - Per-plan limits
- ✅ **Unlimited option** - No cap for premium plans
- ✅ **Overage billing** - Automatic charges for excess usage
- ✅ **Multi-unit support** - MB, GB, TB measurements

---

### 7. **Time-Based Bandwidth Controls** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # Time-based restrictions (e.g., unlimited nights)
    has_time_restrictions: Mapped[bool] = mapped_column(default=False)
    unrestricted_start_time: Mapped[time | None]  # e.g., 23:00
    unrestricted_end_time: Mapped[time | None]    # e.g., 07:00
    unrestricted_data_unlimited: Mapped[bool]     # Unlimited during hours
    unrestricted_speed_multiplier: Mapped[Decimal | None]  # Speed boost
```

**Features:**
- ✅ **Off-peak unlimited** - No caps during specified hours
- ✅ **Speed multipliers** - Boost speeds at night
- ✅ **Flexible scheduling** - Any time range
- ✅ **Popular for ISPs** - "Unlimited nights" feature

**Example:**
```python
plan = InternetServicePlan(
    name="Night Unlimited 50Mbps",
    has_time_restrictions=True,
    unrestricted_start_time=time(23, 0),  # 11 PM
    unrestricted_end_time=time(7, 0),     # 7 AM
    unrestricted_data_unlimited=True,     # No cap at night
    unrestricted_speed_multiplier=2.0     # 2x speed at night
)
```

---

### 8. **Burst Speed Support** ✅

**Location:** `src/dotmac/platform/services/internet_plans/models.py`

```python
class InternetServicePlan:
    # Burst speed (temporary speed boost)
    burst_download_speed: Mapped[Decimal | None]
    burst_upload_speed: Mapped[Decimal | None]
    burst_duration_seconds: Mapped[int | None]  # How long burst lasts
```

**Features:**
- ✅ **Temporary speed boost** - Better user experience for short transfers
- ✅ **Configurable duration** - Control burst window
- ✅ **RADIUS integration** - Applied via bandwidth profiles
- ✅ **Per-plan configuration** - Different burst for each tier

---

## 🔧 Implementation Architecture

### Data Flow for Bandwidth Management

```
1. Plan Configuration
   ↓
   InternetServicePlan (Database)
   - FUP thresholds
   - Contention ratios
   - Traffic shaping rules

2. Subscriber Provisioning
   ↓
   RadiusBandwidthProfile (RADIUS)
   - Download/upload rates
   - Burst speeds

3. Usage Monitoring
   ↓
   usage_monitoring_tasks.py (Celery)
   - Track usage vs caps
   - Generate alerts at thresholds

4. Automated Enforcement
   ↓
   RADIUS COA (Change of Authorization)
   - Apply throttling
   - Update speeds dynamically

5. Billing Integration
   ↓
   Usage Billing System
   - Track overages
   - Generate charges
```

---

## 📊 Feature Comparison Matrix

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **FUP Controls** | ✅ Implemented | `internet_plans/models.py` | Threshold-based throttling |
| **Contention Ratios** | ✅ Implemented | `internet_plans/models.py` | Configurable per plan |
| **Traffic Shaping** | ✅ Implemented | `internet_plans/models.py` | QoS + throttle policies |
| **Bandwidth Profiles** | ✅ Implemented | `radius/models.py` | RADIUS integration |
| **Burst Speeds** | ✅ Implemented | Both models | Temporary speed boost |
| **Data Caps** | ✅ Implemented | `internet_plans/models.py` | Flexible limits |
| **Time-Based Rules** | ✅ Implemented | `internet_plans/models.py` | Off-peak unlimited |
| **Usage Monitoring** | ✅ Implemented | `usage_monitoring_tasks.py` | Automated alerts |
| **Overage Billing** | ✅ Implemented | `internet_plans/models.py` | Automatic charges |
| **RADIUS COA** | ✅ Implemented | `radius/coa_client.py` | Dynamic updates |

---

## 🚀 Usage Examples

### Example 1: Residential Plan with FUP

```python
residential_100mbps = InternetServicePlan(
    tenant_id="isp-123",
    plan_code="RES-100",
    name="Home 100Mbps with FUP",
    plan_type=PlanType.RESIDENTIAL,

    # Base speeds
    download_speed=100,
    upload_speed=50,
    speed_unit=SpeedUnit.MBPS,

    # FUP configuration
    has_fup=True,
    fup_threshold=500,  # 500GB monthly
    fup_threshold_unit=DataUnit.GB,
    fup_throttle_speed=10,  # Throttle to 10Mbps after 500GB

    # Contention
    contention_ratio="1:50",

    # Traffic shaping
    traffic_shaping_enabled=True,
    qos_priority=30,  # Lower priority (residential)

    # Pricing
    monthly_price=Decimal("49.99"),
    currency="USD"
)
```

### Example 2: Business Plan (No FUP)

```python
business_dedicated = InternetServicePlan(
    tenant_id="isp-123",
    plan_code="BIZ-500",
    name="Business 500Mbps Dedicated",
    plan_type=PlanType.BUSINESS,

    # High speeds
    download_speed=500,
    upload_speed=500,  # Symmetric
    speed_unit=SpeedUnit.MBPS,

    # No FUP for business
    has_fup=False,
    has_data_cap=False,  # Unlimited

    # Dedicated bandwidth
    contention_ratio="1:1",  # No sharing

    # High priority traffic
    traffic_shaping_enabled=True,
    qos_priority=90,  # High priority

    # Premium pricing
    monthly_price=Decimal("299.99"),
    currency="USD"
)
```

### Example 3: Night Unlimited Plan

```python
night_unlimited = InternetServicePlan(
    tenant_id="isp-123",
    plan_code="NIGHT-50",
    name="50Mbps Night Unlimited",
    plan_type=PlanType.RESIDENTIAL,

    # Base speeds
    download_speed=50,
    upload_speed=25,
    speed_unit=SpeedUnit.MBPS,

    # Daytime FUP
    has_fup=True,
    fup_threshold=200,  # 200GB daytime
    fup_threshold_unit=DataUnit.GB,
    fup_throttle_speed=5,  # Throttle to 5Mbps

    # Night-time unlimited
    has_time_restrictions=True,
    unrestricted_start_time=time(23, 0),  # 11 PM
    unrestricted_end_time=time(7, 0),     # 7 AM
    unrestricted_data_unlimited=True,     # No cap at night
    unrestricted_speed_multiplier=Decimal("2.0"),  # 2x speed

    # Affordable pricing
    monthly_price=Decimal("29.99"),
    currency="USD"
)
```

---

## 🔄 Automated Traffic Shaping Workflow

### Step 1: Plan Creation
```python
# Create plan with FUP and throttling
plan = create_internet_plan(...)
```

### Step 2: Subscriber Activation
```python
# Subscriber gets provisioned with bandwidth profile
subscriber = provision_subscriber(
    plan_id=plan.id,
    bandwidth_profile_id="profile-100mbps"
)
```

### Step 3: Automated Monitoring
```python
# Celery task runs periodically (e.g., every hour)
@celery_app.task
async def monitor_data_cap_usage():
    # Check all active subscribers
    subscribers = get_active_subscribers_with_caps()

    for subscriber in subscribers:
        usage = get_current_usage(subscriber.id)
        cap = subscriber.plan.fup_threshold

        # Check threshold
        usage_percent = (usage / cap) * 100

        if usage_percent >= 100:
            # FUP exceeded - apply throttling
            await apply_fup_throttling(subscriber)
            send_alert(subscriber, "FUP_EXCEEDED")

        elif usage_percent >= 90:
            send_alert(subscriber, "FUP_WARNING_90")
```

### Step 4: Dynamic Throttling (RADIUS COA)
```python
async def apply_fup_throttling(subscriber):
    """Apply FUP throttling via RADIUS COA."""

    # Get throttled speeds from plan
    plan = subscriber.plan
    throttled_profile = create_bandwidth_profile(
        download_speed=plan.fup_throttle_speed,
        upload_speed=plan.fup_throttle_speed
    )

    # Send RADIUS COA (Change of Authorization)
    await radius_coa_client.update_subscriber_bandwidth(
        username=subscriber.username,
        bandwidth_profile=throttled_profile
    )

    # Log the change
    log_bandwidth_change(
        subscriber_id=subscriber.id,
        reason="FUP_THRESHOLD_EXCEEDED",
        new_speed=plan.fup_throttle_speed
    )
```

---

## 📁 Related Files

| Component | File Path |
|-----------|-----------|
| **Plan Models** | `src/dotmac/platform/services/internet_plans/models.py` |
| **RADIUS Profiles** | `src/dotmac/platform/radius/models.py` |
| **Usage Monitoring** | `src/dotmac/platform/services/internet_plans/usage_monitoring_tasks.py` |
| **RADIUS COA** | `src/dotmac/platform/radius/coa_client.py` |
| **Plan Validation** | `src/dotmac/platform/services/internet_plans/validator.py` |
| **GraphQL Types** | `src/dotmac/platform/graphql/types/network.py` |

---

## ✅ Summary

**YES**, the platform has comprehensive bandwidth management:

- ✅ **FUP Controls** - Threshold-based throttling with configurable limits
- ✅ **Contention Ratios** - Per-plan oversubscription configuration (1:1, 1:20, 1:50)
- ✅ **Automated Traffic Shaping** - QoS priorities, throttle policies, burst speeds
- ✅ **RADIUS Integration** - Dynamic bandwidth profile application
- ✅ **Automated Monitoring** - Celery tasks track usage vs caps
- ✅ **Dynamic Enforcement** - RADIUS COA for real-time speed changes
- ✅ **Time-Based Rules** - Off-peak unlimited and speed boosts
- ✅ **Overage Billing** - Automatic charges for excess usage

**All features are production-ready and fully integrated!** 🚀
