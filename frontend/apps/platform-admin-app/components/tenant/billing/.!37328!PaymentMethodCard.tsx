"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { PaymentMethod } from "@/hooks/useTenantPaymentMethods";
import { CreditCard, Building2, Wallet, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onSetDefault?: (paymentMethodId: string) => void;
  onRemove?: (paymentMethodId: string) => void;
  onVerify?: (paymentMethodId: string) => void;
  isUpdating?: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  pending_verification: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  verification_failed: "bg-red-500/10 text-red-500 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const getCardBrandIcon = (brand?: string) => {
  // Return emoji or use actual brand icons
  const icons: Record<string, string> = {
