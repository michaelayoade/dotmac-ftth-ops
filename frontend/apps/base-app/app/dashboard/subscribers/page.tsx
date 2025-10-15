'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRBAC } from '@/contexts/RBACContext';
import { useRadiusSessions, useRadiusSubscribers, useToggleSubscriber } from '@/hooks/useRadius';
import { useServiceInstances } from '@/hooks/useServiceLifecycle';
import { platformConfig } from '@/lib/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

export default function SubscribersPage() {
  const { hasPermission } = useRBAC();
  const [search, setSearch] = useState('');
  const radiusEnabled = platformConfig.features.enableRadius && hasPermission('isp.radius.read');
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | null>(null);
  const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);

  const { toast } = useToast();

  const { data: subscribers, isLoading } = useRadiusSubscribers({
    limit: 50,
    enabled: radiusEnabled,
  });

  const { data: sessions } = useRadiusSessions({
    enabled: radiusEnabled,
  });

  const { data: activeServices } = useServiceInstances({
    status: 'active',
    limit: 20,
  });

  const toggleSubscriber = useToggleSubscriber();

  const filteredSubscribers = (subscribers ?? []).filter(subscriber =>
    subscriber.username.toLowerCase().includes(search.trim().toLowerCase())
  );

  const selectedSubscriber = subscribers?.find(subscriber => subscriber.id === selectedSubscriberId) ?? null;
  const selectedSessions = selectedSubscriber
    ? (sessions ?? []).filter(session => session.username === selectedSubscriber.username)
    : [];

  if (!radiusEnabled) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscribers</CardTitle>
            <CardDescription>
              Access to RADIUS subscriber records requires the <code>isp.radius.read</code> permission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact a platform administrator to grant ISP operator privileges, or enable the feature flag{' '}
              <code>NEXT_PUBLIC_ENABLE_RADIUS</code>.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Subscriber directory</h1>
        <p className="text-sm text-muted-foreground">
          Manage broadband subscriber credentials, service assignments, and active RADIUS sessions.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tracked subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{subscribers?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">In FreeRADIUS for this tenant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{sessions?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">PPP sessions currently authenticated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{activeServices?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Service instances in ACTIVE status</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RADIUS subscribers</CardTitle>
          <CardDescription>Search and review subscriber credentials and profile settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by username"
            className="max-w-sm"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Framed IP</TableHead>
                  <TableHead>Bandwidth Profile</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading subscribers…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredSubscribers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No subscribers match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filteredSubscribers.map(subscriber => (
                  <TableRow
                    key={subscriber.id}
                    className="cursor-pointer hover:bg-accent/30"
                    onClick={() => {
                      setSelectedSubscriberId(subscriber.id);
                      setSubscriberDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium text-foreground">{subscriber.username}</TableCell>
                    <TableCell>
                      <Badge variant={subscriber.enabled ? 'outline' : 'secondary'}>
                        {subscriber.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscriber.framed_ip_address ?? '—'}</TableCell>
                    <TableCell>{subscriber.bandwidth_profile_id ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(subscriber.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active RADIUS sessions</CardTitle>
          <CardDescription>Live authentication sessions with usage counters.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>NAS IP</TableHead>
                <TableHead>Session ID</TableHead>
                <TableHead>Uptime (s)</TableHead>
                <TableHead>Down / Up (MB)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessions ?? []).slice(0, 20).map(session => (
                <TableRow key={session.radacctid}>
                  <TableCell className="font-medium text-foreground">{session.username}</TableCell>
                  <TableCell>{session.nasipaddress}</TableCell>
                  <TableCell className="font-mono text-xs">{session.acctsessionid}</TableCell>
                  <TableCell>{session.acctsessiontime ?? 0}</TableCell>
                  <TableCell>
                    {((session.acctinputoctets ?? 0) / (1024 * 1024)).toFixed(2)}/
                    {((session.acctoutputoctets ?? 0) / (1024 * 1024)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {!(sessions?.length ?? 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No active sessions at the moment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={subscriberDialogOpen} onOpenChange={setSubscriberDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Subscriber details</DialogTitle>
            <DialogDescription>
              Detailed information for <code>{selectedSubscriber?.username ?? '—'}</code>
            </DialogDescription>
          </DialogHeader>
          {selectedSubscriber ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscriber ID</span>
                  <span className="font-medium text-foreground">{selectedSubscriber.subscriber_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={selectedSubscriber.enabled ? 'outline' : 'secondary'}>
                    {selectedSubscriber.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bandwidth profile</span>
                  <span className="font-medium text-foreground">
                    {selectedSubscriber.bandwidth_profile_id ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Framed IP address</span>
                  <span className="font-medium text-foreground">
                    {selectedSubscriber.framed_ip_address ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(selectedSubscriber.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{new Date(selectedSubscriber.updated_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent sessions
                </p>
                {selectedSessions.length ? (
                  <div className="max-h-48 overflow-y-auto rounded border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">NAS</TableHead>
                          <TableHead className="text-xs">Session ID</TableHead>
                          <TableHead className="text-xs">Start</TableHead>
                          <TableHead className="text-xs">Duration (s)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSessions.map(session => (
                          <TableRow key={session.radacctid}>
                            <TableCell className="text-xs">{session.nasipaddress}</TableCell>
                            <TableCell className="text-xs font-mono">{session.acctsessionid}</TableCell>
                            <TableCell className="text-xs">
                              {session.acctstarttime ? new Date(session.acctstarttime).toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="text-xs">{session.acctsessiontime ?? 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No sessions recorded for this subscriber.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a subscriber to view details.</p>
          )}
          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Actions apply immediately via RADIUS API.
            </div>
            <div className="flex gap-2">
              {selectedSubscriber?.enabled ? (
                <Button
                  variant="destructive"
                  disabled={toggleSubscriber.isLoading}
                  onClick={async () => {
                    if (!selectedSubscriber) return;
                    try {
                      await toggleSubscriber.mutateAsync({ username: selectedSubscriber.username, action: 'disable' });
                      toast({ title: 'Subscriber disabled', description: `${selectedSubscriber.username} access revoked.` });
                    } catch (error) {
                      logger.error('Failed to disable subscriber', error instanceof Error ? error : new Error(String(error)));
                      toast({
                        title: 'Disable failed',
                        description: 'Unable to disable subscriber. Check logs for details.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Disable access
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={toggleSubscriber.isLoading}
                  onClick={async () => {
                    if (!selectedSubscriber) return;
                    try {
                      await toggleSubscriber.mutateAsync({ username: selectedSubscriber.username, action: 'enable' });
                      toast({ title: 'Subscriber enabled', description: `${selectedSubscriber.username} access restored.` });
                    } catch (error) {
                      logger.error('Failed to enable subscriber', error instanceof Error ? error : new Error(String(error)));
                      toast({
                        title: 'Enable failed',
                        description: 'Unable to enable subscriber. Check logs for details.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Enable access
                </Button>
              )}
              <Button variant="outline" onClick={() => setSubscriberDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
