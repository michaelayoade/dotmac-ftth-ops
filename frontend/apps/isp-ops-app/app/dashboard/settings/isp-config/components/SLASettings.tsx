/**
 * SLA & Support Configuration Component
 *
 * Configures service level agreements, response times, business hours,
 * and auto-escalation policies for support tickets.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Calendar, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SLASettingsProps {
  settings: {
    priority_urgent_response_hours: number;
    priority_high_response_hours: number;
    priority_medium_response_hours: number;
    priority_low_response_hours: number;
    priority_urgent_resolution_hours: number;
    priority_high_resolution_hours: number;
    priority_medium_resolution_hours: number;
    priority_low_resolution_hours: number;
    business_hours_start: string;
    business_hours_end: string;
    business_days: string[];
    auto_escalate: boolean;
    escalation_threshold_percent: number;
    include_weekends: boolean;
  };
  onChange: (settings: any) => void;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "tuesday", label: "Tuesday", short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday", label: "Thursday", short: "Thu" },
  { value: "friday", label: "Friday", short: "Fri" },
  { value: "saturday", label: "Saturday", short: "Sat" },
  { value: "sunday", label: "Sunday", short: "Sun" },
];

export function SLASettings({ settings, onChange }: SLASettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const toggleBusinessDay = (day: string) => {
    const currentDays = settings.business_days || [];
    if (currentDays.includes(day)) {
      updateSetting(
        "business_days",
        currentDays.filter((d) => d !== day),
      );
    } else {
      updateSetting("business_days", [...currentDays, day]);
    }
  };

  const formatHours = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minutes`;
    }
    if (hours < 24) {
      const whole = Math.floor(hours);
      const mins = Math.round((hours - whole) * 60);
      return mins > 0 ? `${whole}h ${mins}m` : `${whole} hours`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return remainingHours > 0 ? `${days} days ${remainingHours}h` : `${days} days`;
  };

  const isValidTime = (time: string): boolean => {
    return /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(time);
  };

  const businessDaysCount = settings.business_days?.length || 0;
  const businessHoursPerDay = (() => {
    if (!isValidTime(settings.business_hours_start) || !isValidTime(settings.business_hours_end)) {
      return 0;
    }
    const startParts = settings.business_hours_start.split(":").map(Number);
    const endParts = settings.business_hours_end.split(":").map(Number);
    const startHour = startParts[0] ?? 0;
    const startMin = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMin = endParts[1] ?? 0;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  })();

  return (
    <div className="space-y-6">
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          SLA settings define response and resolution time commitments for support tickets. Times
          are calculated based on business hours only.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Response Time SLAs</CardTitle>
          <CardDescription>
            How quickly tickets should receive an initial response (in hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Urgent Priority */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="response_urgent">Urgent Priority</Label>
                <Badge variant="destructive" className="text-xs">
                  Critical
                </Badge>
              </div>
              <Input
                id="response_urgent"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={settings.priority_urgent_response_hours}
                onChange={(e) =>
                  updateSetting("priority_urgent_response_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_urgent_response_hours)}
              </p>
            </div>

            {/* High Priority */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="response_high">High Priority</Label>
                <Badge variant="default" className="text-xs">
                  Important
                </Badge>
              </div>
              <Input
                id="response_high"
                type="number"
                min="0.25"
                max="48"
                step="0.25"
                value={settings.priority_high_response_hours}
                onChange={(e) =>
                  updateSetting("priority_high_response_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_high_response_hours)}
              </p>
            </div>

            {/* Medium Priority */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="response_medium">Medium Priority</Label>
                <Badge variant="secondary" className="text-xs">
                  Normal
                </Badge>
              </div>
              <Input
                id="response_medium"
                type="number"
                min="0.25"
                max="72"
                step="0.25"
                value={settings.priority_medium_response_hours}
                onChange={(e) =>
                  updateSetting("priority_medium_response_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_medium_response_hours)}
              </p>
            </div>

            {/* Low Priority */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="response_low">Low Priority</Label>
                <Badge variant="outline" className="text-xs">
                  Minor
                </Badge>
              </div>
              <Input
                id="response_low"
                type="number"
                min="1"
                max="168"
                step="1"
                value={settings.priority_low_response_hours}
                onChange={(e) =>
                  updateSetting("priority_low_response_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_low_response_hours)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolution Time SLAs</CardTitle>
          <CardDescription>How quickly tickets should be fully resolved (in hours)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Urgent Priority */}
            <div className="space-y-2">
              <Label htmlFor="resolution_urgent">Urgent Priority</Label>
              <Input
                id="resolution_urgent"
                type="number"
                min="1"
                max="48"
                step="0.5"
                value={settings.priority_urgent_resolution_hours}
                onChange={(e) =>
                  updateSetting("priority_urgent_resolution_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_urgent_resolution_hours)}
              </p>
            </div>

            {/* High Priority */}
            <div className="space-y-2">
              <Label htmlFor="resolution_high">High Priority</Label>
              <Input
                id="resolution_high"
                type="number"
                min="1"
                max="168"
                step="1"
                value={settings.priority_high_resolution_hours}
                onChange={(e) =>
                  updateSetting("priority_high_resolution_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_high_resolution_hours)}
              </p>
            </div>

            {/* Medium Priority */}
            <div className="space-y-2">
              <Label htmlFor="resolution_medium">Medium Priority</Label>
              <Input
                id="resolution_medium"
                type="number"
                min="1"
                max="336"
                step="1"
                value={settings.priority_medium_resolution_hours}
                onChange={(e) =>
                  updateSetting("priority_medium_resolution_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_medium_resolution_hours)}
              </p>
            </div>

            {/* Low Priority */}
            <div className="space-y-2">
              <Label htmlFor="resolution_low">Low Priority</Label>
              <Input
                id="resolution_low"
                type="number"
                min="1"
                max="720"
                step="1"
                value={settings.priority_low_resolution_hours}
                onChange={(e) =>
                  updateSetting("priority_low_resolution_hours", parseFloat(e.target.value))
                }
              />
              <p className="text-sm text-muted-foreground">
                {formatHours(settings.priority_low_resolution_hours)}
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Resolution times should be greater than response times. SLA violations trigger
              notifications and can auto-escalate tickets.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
          <CardDescription>Define when SLA timers are active</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Business Hours Start */}
            <div className="space-y-2">
              <Label htmlFor="hours_start">Business Day Start</Label>
              <Input
                id="hours_start"
                type="time"
                value={settings.business_hours_start}
                onChange={(e) => updateSetting("business_hours_start", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                When business hours begin (24-hour format)
              </p>
            </div>

            {/* Business Hours End */}
            <div className="space-y-2">
              <Label htmlFor="hours_end">Business Day End</Label>
              <Input
                id="hours_end"
                type="time"
                value={settings.business_hours_end}
                onChange={(e) => updateSetting("business_hours_end", e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                When business hours end (24-hour format)
              </p>
            </div>
          </div>

          {!isValidTime(settings.business_hours_start) ||
          !isValidTime(settings.business_hours_end) ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Invalid time format. Use HH:MM format (e.g., 09:00, 17:30)
              </AlertDescription>
            </Alert>
          ) : businessHoursPerDay <= 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Business hours end must be after start time</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Business hours: {settings.business_hours_start} - {settings.business_hours_end} (
                {businessHoursPerDay.toFixed(1)} hours per day)
              </AlertDescription>
            </Alert>
          )}

          {/* Business Days */}
          <div className="space-y-2">
            <Label>Business Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = settings.business_days?.includes(day.value);
                return (
                  <Badge
                    key={day.value}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleBusinessDay(day.value)}
                  >
                    {day.short}
                  </Badge>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Click to toggle business days ({businessDaysCount} days selected)
            </p>
          </div>

          {businessDaysCount === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>At least one business day must be selected</AlertDescription>
            </Alert>
          )}

          {/* Include Weekends Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include_weekends">Include Weekends in SLA Calculation</Label>
              <p className="text-sm text-muted-foreground">
                Count Saturday and Sunday towards SLA timers (24/7 support)
              </p>
            </div>
            <Switch
              id="include_weekends"
              checked={settings.include_weekends}
              onCheckedChange={(checked) => updateSetting("include_weekends", checked)}
            />
          </div>

          {settings.include_weekends && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Weekend coverage enabled: SLA timers will continue running on weekends. Ensure
                adequate staff coverage for 24/7 support.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Escalation</CardTitle>
          <CardDescription>Automatically escalate tickets approaching SLA breach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_escalate">Enable Auto-Escalation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically escalate tickets when approaching SLA deadline
              </p>
            </div>
            <Switch
              id="auto_escalate"
              checked={settings.auto_escalate}
              onCheckedChange={(checked) => updateSetting("auto_escalate", checked)}
            />
          </div>

          {settings.auto_escalate && (
            <div className="space-y-2">
              <Label htmlFor="escalation_threshold">Escalation Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="escalation_threshold"
                  type="number"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.escalation_threshold_percent}
                  onChange={(e) =>
                    updateSetting("escalation_threshold_percent", parseInt(e.target.value))
                  }
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">% of SLA time elapsed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Escalate when {settings.escalation_threshold_percent}% of SLA time has passed (e.g.,
                at{" "}
                {formatHours(
                  (settings.priority_urgent_response_hours *
                    settings.escalation_threshold_percent) /
                    100,
                )}{" "}
                for urgent response)
              </p>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Escalated tickets are assigned to supervisors or managers based on escalation rules.
              Notifications are sent to relevant stakeholders.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* SLA Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Summary</CardTitle>
          <CardDescription>Overview of current SLA configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Response Time Targets:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Urgent: {formatHours(settings.priority_urgent_response_hours)}</li>
                <li>High: {formatHours(settings.priority_high_response_hours)}</li>
                <li>Medium: {formatHours(settings.priority_medium_response_hours)}</li>
                <li>Low: {formatHours(settings.priority_low_response_hours)}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Resolution Time Targets:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Urgent: {formatHours(settings.priority_urgent_resolution_hours)}</li>
                <li>High: {formatHours(settings.priority_high_resolution_hours)}</li>
                <li>Medium: {formatHours(settings.priority_medium_resolution_hours)}</li>
                <li>Low: {formatHours(settings.priority_low_resolution_hours)}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Business Hours:</h4>
              <p className="text-sm text-muted-foreground">
                {settings.business_hours_start} - {settings.business_hours_end} (
                {businessHoursPerDay.toFixed(1)} hours/day)
              </p>
              <p className="text-sm text-muted-foreground">
                Business days: {businessDaysCount} days/week
                {settings.include_weekends && " (includes weekends)"}
              </p>
            </div>
            {settings.auto_escalate && (
              <div>
                <h4 className="font-medium mb-2">Auto-Escalation:</h4>
                <p className="text-sm text-muted-foreground">
                  Enabled at {settings.escalation_threshold_percent}% threshold
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
