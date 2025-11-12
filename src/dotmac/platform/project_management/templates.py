"""
Project Templates for Auto-Generation

Defines templates for different project types that can be automatically
created when sales orders are completed.
"""

from dotmac.platform.project_management.models import (
    ProjectType,
    TaskPriority,
    TaskType,
)


class TaskTemplate:
    """Template for a task within a project"""

    def __init__(
        self,
        name: str,
        task_type: TaskType,
        sequence_order: int,
        estimated_duration_minutes: int,
        priority: TaskPriority = TaskPriority.NORMAL,
        required_skills: dict[str, bool] | None = None,
        required_equipment: list[str] | None = None,
        required_certifications: list[str] | None = None,
        requires_customer_presence: bool = False,
        description: str = "",
        depends_on_task_order: list[int] | None = None,
    ):
        self.name = name
        self.task_type = task_type
        self.sequence_order = sequence_order
        self.estimated_duration_minutes = estimated_duration_minutes
        self.priority = priority
        self.required_skills = required_skills or {}
        self.required_equipment = required_equipment or []
        self.required_certifications = required_certifications or []
        self.requires_customer_presence = requires_customer_presence
        self.description = description
        self.depends_on_task_order = depends_on_task_order or []


class ProjectTemplate:
    """Template for a multi-step project"""

    def __init__(
        self,
        name_pattern: str,  # e.g. "Fiber Installation - {customer_name}"
        project_type: ProjectType,
        estimated_duration_hours: float,
        priority: TaskPriority,
        tasks: list[TaskTemplate],
        required_team_type: str | None = None,
        description_pattern: str = "",
    ):
        self.name_pattern = name_pattern
        self.project_type = project_type
        self.estimated_duration_hours = estimated_duration_hours
        self.priority = priority
        self.tasks = tasks
        self.required_team_type = required_team_type
        self.description_pattern = description_pattern


# ============================================================================
# FIBER INSTALLATION PROJECT TEMPLATE
# ============================================================================

FIBER_INSTALLATION_TEMPLATE = ProjectTemplate(
    name_pattern="Fiber Installation - {{ customer_name|title }}",
    project_type=ProjectType.INSTALLATION,
    estimated_duration_hours=8.0,
    priority=TaskPriority.HIGH,
    required_team_type="installation",
    description_pattern="Complete fiber installation for {{ customer_name }} at {{ service_address }}",
    tasks=[
        TaskTemplate(
            name="Site Survey",
            task_type=TaskType.SITE_SURVEY,
            sequence_order=1,
            estimated_duration_minutes=60,
            priority=TaskPriority.HIGH,
            required_skills={"site_survey": True, "measurement": True},
            required_equipment=["measuring_tape", "laser_distance_meter", "camera"],
            description="Conduct site survey and assess fiber routing requirements",
        ),
        TaskTemplate(
            name="Fiber Route Planning",
            task_type=TaskType.FIBER_ROUTING,
            sequence_order=2,
            estimated_duration_minutes=30,
            priority=TaskPriority.NORMAL,
            required_skills={"fiber_planning": True, "cad": True},
            description="Plan optimal fiber route from distribution point to customer premises",
            depends_on_task_order=[1],  # Depends on site survey
        ),
        TaskTemplate(
            name="Trenching/Conduit Installation",
            task_type=TaskType.TRENCHING,
            sequence_order=3,
            estimated_duration_minutes=180,
            priority=TaskPriority.NORMAL,
            required_skills={"trenching": True, "excavation": True},
            required_equipment=["trencher", "shovel", "conduit"],
            required_certifications=["excavation_safety"],
            description="Dig trench and install conduit for fiber cable",
            depends_on_task_order=[2],
        ),
        TaskTemplate(
            name="Fiber Cable Pulling",
            task_type=TaskType.CABLE_PULLING,
            sequence_order=4,
            estimated_duration_minutes=90,
            priority=TaskPriority.NORMAL,
            required_skills={"cable_pulling": True},
            required_equipment=["cable_puller", "lubricant", "fiber_cable"],
            description="Pull fiber cable through conduit",
            depends_on_task_order=[3],
        ),
        TaskTemplate(
            name="Fiber Splicing",
            task_type=TaskType.SPLICING,
            sequence_order=5,
            estimated_duration_minutes=120,
            priority=TaskPriority.HIGH,
            required_skills={"fiber_splicing": True, "fusion_splicing": True},
            required_equipment=["fusion_splicer", "otdr", "cleaver"],
            required_certifications=["fiber_optic_technician"],
            description="Splice fiber cable at distribution point and customer end",
            depends_on_task_order=[4],
        ),
        TaskTemplate(
            name="OLT/ONT Installation",
            task_type=TaskType.ONT_INSTALLATION,
            sequence_order=6,
            estimated_duration_minutes=60,
            priority=TaskPriority.NORMAL,
            required_skills={"ont_installation": True, "networking": True},
            required_equipment=["ont_device", "power_adapter", "ethernet_cables"],
            description="Install and configure ONT at customer premises",
            depends_on_task_order=[5],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="CPE Installation & Configuration",
            task_type=TaskType.CPE_INSTALLATION,
            sequence_order=7,
            estimated_duration_minutes=45,
            priority=TaskPriority.NORMAL,
            required_skills={"router_config": True, "networking": True},
            required_equipment=["router", "wifi_ap", "ethernet_cables"],
            description="Install router/WiFi and configure customer network",
            depends_on_task_order=[6],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="Testing & Verification",
            task_type=TaskType.TESTING,
            sequence_order=8,
            estimated_duration_minutes=30,
            priority=TaskPriority.HIGH,
            required_skills={"testing": True, "otdr": True, "speed_test": True},
            required_equipment=["otdr", "speed_test_tool", "laptop"],
            description="Test fiber signal quality and internet connectivity",
            depends_on_task_order=[7],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="Customer Training",
            task_type=TaskType.CUSTOMER_TRAINING,
            sequence_order=9,
            estimated_duration_minutes=20,
            priority=TaskPriority.NORMAL,
            required_skills={"customer_service": True},
            description="Train customer on using the service and equipment",
            depends_on_task_order=[8],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="Documentation & Closeout",
            task_type=TaskType.CLOSEOUT,
            sequence_order=10,
            estimated_duration_minutes=15,
            priority=TaskPriority.NORMAL,
            required_skills={"documentation": True},
            description="Complete installation documentation and customer sign-off",
            depends_on_task_order=[9],
            requires_customer_presence=True,
        ),
    ],
)


# ============================================================================
# WIRELESS INSTALLATION PROJECT TEMPLATE
# ============================================================================

WIRELESS_INSTALLATION_TEMPLATE = ProjectTemplate(
    name_pattern="Wireless Installation - {{ customer_name|title }}",
    project_type=ProjectType.INSTALLATION,
    estimated_duration_hours=4.0,
    priority=TaskPriority.HIGH,
    required_team_type="installation",
    description_pattern="Complete wireless installation for {{ customer_name }} at {{ service_address }}",
    tasks=[
        TaskTemplate(
            name="Site Survey & Signal Testing",
            task_type=TaskType.SITE_SURVEY,
            sequence_order=1,
            estimated_duration_minutes=45,
            priority=TaskPriority.HIGH,
            required_skills={"site_survey": True, "rf_testing": True},
            required_equipment=["spectrum_analyzer", "signal_meter", "laptop"],
            description="Conduct site survey and test signal strength from base station",
        ),
        TaskTemplate(
            name="Antenna Installation",
            task_type=TaskType.CPE_INSTALLATION,
            sequence_order=2,
            estimated_duration_minutes=90,
            priority=TaskPriority.HIGH,
            required_skills={"antenna_installation": True, "roofwork": True},
            required_equipment=["antenna", "mounting_bracket", "cables", "drill", "ladder"],
            required_certifications=["height_safety"],
            description="Install outdoor antenna and align with base station",
            depends_on_task_order=[1],
        ),
        TaskTemplate(
            name="CPE Configuration",
            task_type=TaskType.CPE_INSTALLATION,
            sequence_order=3,
            estimated_duration_minutes=30,
            priority=TaskPriority.NORMAL,
            required_skills={"wireless_config": True, "networking": True},
            required_equipment=["poe_injector", "ethernet_cables"],
            description="Configure CPE radio and establish link to base station",
            depends_on_task_order=[2],
        ),
        TaskTemplate(
            name="Router Installation",
            task_type=TaskType.CPE_INSTALLATION,
            sequence_order=4,
            estimated_duration_minutes=30,
            priority=TaskPriority.NORMAL,
            required_skills={"router_config": True, "networking": True},
            required_equipment=["router", "wifi_ap", "ethernet_cables"],
            description="Install and configure customer router and WiFi",
            depends_on_task_order=[3],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="Testing & Optimization",
            task_type=TaskType.TESTING,
            sequence_order=5,
            estimated_duration_minutes=30,
            priority=TaskPriority.HIGH,
            required_skills={"testing": True, "rf_optimization": True},
            required_equipment=["spectrum_analyzer", "speed_test_tool", "laptop"],
            description="Test link quality, signal strength, and internet speed",
            depends_on_task_order=[4],
            requires_customer_presence=True,
        ),
        TaskTemplate(
            name="Customer Training & Closeout",
            task_type=TaskType.CUSTOMER_TRAINING,
            sequence_order=6,
            estimated_duration_minutes=15,
            priority=TaskPriority.NORMAL,
            required_skills={"customer_service": True},
            description="Train customer and complete documentation",
            depends_on_task_order=[5],
            requires_customer_presence=True,
        ),
    ],
)


# ============================================================================
# MAINTENANCE PROJECT TEMPLATE
# ============================================================================

MAINTENANCE_TEMPLATE = ProjectTemplate(
    name_pattern="Scheduled Maintenance - {{ customer_name|title }}",
    project_type=ProjectType.MAINTENANCE,
    estimated_duration_hours=2.0,
    priority=TaskPriority.NORMAL,
    required_team_type="maintenance",
    description_pattern="Scheduled maintenance visit for {{ customer_name }}",
    tasks=[
        TaskTemplate(
            name="Equipment Inspection",
            task_type=TaskType.INSPECTION,
            sequence_order=1,
            estimated_duration_minutes=30,
            priority=TaskPriority.NORMAL,
            required_skills={"inspection": True},
            description="Inspect all customer equipment for issues",
        ),
        TaskTemplate(
            name="Signal/Performance Testing",
            task_type=TaskType.TESTING,
            sequence_order=2,
            estimated_duration_minutes=30,
            priority=TaskPriority.NORMAL,
            required_skills={"testing": True},
            required_equipment=["testing_equipment"],
            description="Test signal quality and network performance",
            depends_on_task_order=[1],
        ),
        TaskTemplate(
            name="Preventive Maintenance",
            task_type=TaskType.CUSTOM,
            sequence_order=3,
            estimated_duration_minutes=45,
            priority=TaskPriority.NORMAL,
            required_skills={"maintenance": True},
            description="Perform preventive maintenance tasks",
            depends_on_task_order=[2],
        ),
        TaskTemplate(
            name="Documentation",
            task_type=TaskType.DOCUMENTATION,
            sequence_order=4,
            estimated_duration_minutes=15,
            priority=TaskPriority.NORMAL,
            description="Document maintenance activities and findings",
            depends_on_task_order=[3],
        ),
    ],
)


# Template registry - maps order types or service types to templates
PROJECT_TEMPLATES = {
    "fiber_installation": FIBER_INSTALLATION_TEMPLATE,
    "wireless_installation": WIRELESS_INSTALLATION_TEMPLATE,
    "maintenance": MAINTENANCE_TEMPLATE,
}


def get_template_for_order(
    order_type: str, service_type: str | None = None
) -> ProjectTemplate | None:
    """
    Get the appropriate project template based on order and service type.

    Args:
        order_type: Type of order (e.g., "new_tenant", "addon")
        service_type: Type of service (e.g., "fiber", "wireless")

    Returns:
        ProjectTemplate or None if no template matches
    """
    # Map order/service types to templates
    if service_type:
        if "fiber" in service_type.lower():
            return PROJECT_TEMPLATES.get("fiber_installation")
        elif "wireless" in service_type.lower() or "radio" in service_type.lower():
            return PROJECT_TEMPLATES.get("wireless_installation")

    # Default based on order type
    if order_type in ["new_tenant", "addon"]:
        # Default to fiber installation for new installations
        return PROJECT_TEMPLATES.get("fiber_installation")

    return None
