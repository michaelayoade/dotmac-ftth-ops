"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Mail, Phone, Building2, Calendar, User, Trash2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import { formatDistanceToNow } from "date-fns";

interface Contact {
  id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  company?: string | null;
  job_title?: string | null;
  department?: string | null;
  status: string;
  stage: string;
  notes?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
  contact_methods?: ContactMethod[];
}

interface ContactMethod {
  id: string;
  type: string;
  value: string;
  label?: string | null;
  is_primary: boolean;
  is_verified: boolean;
}

interface Activity {
  id: string;
  activity_type: string;
  subject?: string | null;
  description?: string | null;
  performed_at: string;
  performed_by?: string | null;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const contactId = params["id"] as string;
  const confirmDialog = useConfirmDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({});

  // Fetch contact
  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/contacts/${contactId}`);
        const data = response.data;
        setFormData(data);
        return data;
      } catch (error) {
        logger.error("Failed to fetch contact", { error });
        throw error;
      }
    },
  });

  // Fetch activities
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/contacts/${contactId}/activities`);
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch activities", { error });
        return [];
      }
    },
  });

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const response = await apiClient.patch(`/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "Contact updated",
        description: "Contact has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/contacts/${contactId}`);
    },
    onSuccess: () => {
      toast({
        title: "Contact deleted",
        description: "Contact has been deleted successfully.",
      });
      router.push("/dashboard/crm/contacts");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: "Delete contact",
      description: "Are you sure you want to delete this contact? This action cannot be undone.",
      confirmText: "Delete contact",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-muted-foreground">Contact not found</div>
        <Link href="/dashboard/crm/contacts">
          <Button>Back to Contacts</Button>
        </Link>
      </div>
    );
  }

  const getContactMethodIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "phone":
      case "mobile":
        return <Phone className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/crm/contacts">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {contact.display_name ||
                `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                "Contact Details"}
            </h1>
            <p className="text-muted-foreground">
              {contact.job_title && contact.company
                ? `${contact.job_title} at ${contact.company}`
                : contact.company || contact.job_title || "Contact information"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void handleDelete();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        <Badge variant="default">{contact.status}</Badge>
        <Badge variant="outline">{contact.stage}</Badge>
        {contact.tags?.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          {isEditing ? (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name || ""}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middle_name">Middle Name</Label>
                        <Input
                          id="middle_name"
                          value={formData.middle_name || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, middle_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name || ""}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          value={formData.company || ""}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job_title">Job Title</Label>
                        <Input
                          id="job_title"
                          value={formData.job_title || ""}
                          onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={formData.department || ""}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData["status"] || ""}
                          onValueChange={(value) => setFormData({ ...formData, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stage">Stage</Label>
                        <Select
                          value={formData.stage || ""}
                          onValueChange={(value) => setFormData({ ...formData, stage: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="prospect">Prospect</SelectItem>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes || ""}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-4 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(contact);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Full Name</Label>
                      <p className="font-medium">
                        {[
                          contact.prefix,
                          contact.first_name,
                          contact.middle_name,
                          contact.last_name,
                          contact.suffix,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Display Name</Label>
                      <p className="font-medium">{contact.display_name || "—"}</p>
                    </div>
                  </div>

                  {contact.contact_methods && contact.contact_methods.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Contact Methods</Label>
                      <div className="space-y-2">
                        {contact.contact_methods.map((method) => (
                          <div
                            key={method.id}
                            className="flex items-center gap-2 p-2 bg-accent/50 rounded"
                          >
                            {getContactMethodIcon(method.type)}
                            <span className="font-medium capitalize">{method.type}:</span>
                            <span>{method.value}</span>
                            {method.label && (
                              <Badge variant="outline" className="text-xs">
                                {method.label}
                              </Badge>
                            )}
                            {method.is_primary && (
                              <Badge variant="default" className="text-xs">
                                Primary
                              </Badge>
                            )}
                            {method.is_verified && (
                              <Badge variant="default" className="text-xs bg-green-500">
                                Verified
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Organization */}
              {(contact.company || contact.job_title || contact.department) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Organization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {contact.company && (
                        <div>
                          <Label className="text-muted-foreground">Company</Label>
                          <p className="font-medium">{contact.company}</p>
                        </div>
                      )}
                      {contact.job_title && (
                        <div>
                          <Label className="text-muted-foreground">Job Title</Label>
                          <p className="font-medium">{contact.job_title}</p>
                        </div>
                      )}
                      {contact.department && (
                        <div>
                          <Label className="text-muted-foreground">Department</Label>
                          <p className="font-medium">{contact.department}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {contact.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{contact.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p className="font-medium">
                        {formatDistanceToNow(new Date(contact.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Updated</Label>
                      <p className="font-medium">
                        {formatDistanceToNow(new Date(contact.updated_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              {activities && activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="border-l-2 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">{activity.activity_type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.performed_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {activity.subject && <p className="font-medium">{activity.subject}</p>}
                      {activity.description && (
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activities recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
