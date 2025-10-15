"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, Clock } from "lucide-react"
import { platformAdminService } from "@/lib/services/platform-admin-service"
import { useToast } from "@/components/ui/use-toast"

// Type definition for audit actions displayed in UI
interface AuditAction {
  id: string
  action: string
  resourceType: string
  timestamp: string
  userId: string
  tenantId?: string
  status: 'success' | 'failure'
  details?: Record<string, unknown>
}

export function AuditLogViewer() {
  const [actions, setActions] = useState<AuditAction[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadAuditLog = useCallback(async () => {
    setLoading(true)
    try {
      const data = await platformAdminService.getAuditLogs()
      const mappedActions: AuditAction[] = (data.entries ?? []).map((entry) => ({
        id: entry.id,
        action: entry.action,
        resourceType: entry.resource_type,
        timestamp: entry.timestamp,
        userId: entry.user_id,
        tenantId: entry.tenant_id,
        status: entry.status,
        details: entry.changes ?? undefined,
      }))
      setActions(mappedActions)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch audit log"
      toast({ title: "Unable to load audit log", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadAuditLog()
    const interval = setInterval(() => {
      void loadAuditLog()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadAuditLog])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Platform Audit Log
            </CardTitle>
            <CardDescription>
              Recent platform administrator actions across all tenants
            </CardDescription>
          </div>
          <Badge variant="outline">{actions.length} actions</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading audit log...
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No audit actions recorded yet</p>
              <p className="text-sm mt-1">
                Platform admin actions will be logged here for compliance
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{action.action}</Badge>
                        <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                          {action.status ?? 'unknown'}
                        </Badge>
                        {action.tenantId && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {action.tenantId}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        User: <span className="font-mono">{action.userId}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Resource: <span className="font-mono">{action.resourceType}</span>
                      </p>
                      {action.details && Object.keys(action.details).length > 0 && (
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(action.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(action.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
