"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { User, Mail, Phone, MapPin, Calendar } from "lucide-react";

interface CustomerOverviewCardProps {
  customer: {
    id: string;
    display_name?: string;
    email: string;
    phone?: string | null;
    accountNumber?: string;
    createdAt?: string;
    tier?: string;
  };
}

export function CustomerOverviewCard({ customer }: CustomerOverviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Customer Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium text-sm">{customer.email}</p>
          </div>
        </div>
        {customer.phone && (
          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium text-sm">{customer.phone}</p>
            </div>
          </div>
        )}
        {customer.accountNumber && (
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Account Number</p>
              <p className="font-mono font-medium text-sm">{customer.accountNumber}</p>
            </div>
          </div>
        )}
        {customer.createdAt && (
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Customer Since</p>
              <p className="font-medium text-sm">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
