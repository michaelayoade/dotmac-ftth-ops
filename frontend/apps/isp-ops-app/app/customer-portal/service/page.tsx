"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Wifi, Zap, CheckCircle, Info, ArrowRight, Loader2 } from "lucide-react";
import { formatCurrency } from "@dotmac/features/billing";
import { useCustomerService } from "@/hooks/useCustomerPortal";
import { useToast } from "@dotmac/ui";

export default function CustomerServicePage() {
  const { toast } = useToast();
  const { service, loading, upgradePlan } = useCustomerService();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading service information...</p>
        </div>
      </div>
    );
  }

  const currentPlan = service
    ? {
        name: service.plan_name,
        speed_down: service.speed_down,
        speed_up: service.speed_up,
        price: service.monthly_price,
        features: ["Unlimited Data", "No Contracts", "Free Installation", "24/7 Support"],
      }
    : null;

  const handleUpgrade = async (planId: string) => {
    try {
      await upgradePlan(planId);
      toast({
        title: "Plan Upgrade Requested",
        description:
          "Your plan upgrade has been requested. We&apos;ll contact you to complete the process.",
      });
    } catch (error) {
      toast({
        title: "Upgrade Failed",
        description: error instanceof Error ? error.message : "Failed to request upgrade",
        variant: "destructive",
      });
    }
  };

  const availablePlans = [
    {
      id: "fiber-50",
      name: "Fiber 50 Mbps",
      speed_down: "50 Mbps",
      speed_up: "50 Mbps",
      price: 49.99,
      recommended: false,
      current: currentPlan?.name === "Fiber 50 Mbps",
      features: ["Unlimited Data", "Perfect for 1-2 users", "Streaming HD video", "24/7 Support"],
    },
    {
      id: "fiber-100",
      name: "Fiber 100 Mbps",
      speed_down: "100 Mbps",
      speed_up: "100 Mbps",
      price: 79.99,
      recommended: true,
      current: currentPlan?.name === "Fiber 100 Mbps",
      features: ["Unlimited Data", "Perfect for 3-4 users", "Streaming 4K video", "Online gaming"],
    },
    {
      id: "fiber-500",
      name: "Fiber 500 Mbps",
      speed_down: "500 Mbps",
      speed_up: "500 Mbps",
      price: 129.99,
      recommended: false,
      current: currentPlan?.name === "Fiber 500 Mbps",
      features: [
        "Unlimited Data",
        "Perfect for 5+ users",
        "Multiple 4K streams",
        "Smart home devices",
      ],
    },
    {
      id: "fiber-1000",
      name: "Fiber 1 Gig",
      speed_down: "1000 Mbps",
      speed_up: "1000 Mbps",
      price: 179.99,
      recommended: false,
      current: currentPlan?.name === "Fiber 1 Gig",
      features: [
        "Unlimited Data",
        "Ultimate performance",
        "Large file downloads",
        "Professional use",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Service</h1>
        <p className="text-muted-foreground">Manage your internet plan</p>
      </div>

      {/* Current Plan */}
      <Card className="border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Your active internet service</CardDescription>
            </div>
            <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {currentPlan ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                <p className="text-3xl font-bold text-primary mt-2">
                  {formatCurrency(currentPlan.price)}
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </p>
              </div>

              <div className="flex gap-8 py-4">
                <div>
                  <p className="text-sm text-muted-foreground">Download Speed</p>
                  <p className="text-xl font-bold text-blue-500">{currentPlan.speed_down}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upload Speed</p>
                  <p className="text-xl font-bold text-green-500">{currentPlan.speed_up}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Features:</p>
                <div className="grid grid-cols-2 gap-2">
                  {currentPlan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No service plan information available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Available Plans
        </h2>
        <p className="text-muted-foreground mb-6">Upgrade or downgrade your service at any time</p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {availablePlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.recommended ? "border-primary shadow-lg" : ""}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-primary">
                    Recommended
                  </Badge>
                </div>
              )}
              {plan.current && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="outline" className="bg-green-500">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="pt-2">
                  <p className="text-3xl font-bold">{formatCurrency(plan.price)}</p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Download:</span>
                    <span className="font-medium text-blue-500">{plan.speed_down}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Upload:</span>
                    <span className="font-medium text-green-500">{plan.speed_up}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full mt-4"
                  variant={plan.current ? "outline" : "default"}
                  disabled={plan.current}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.current ? (
                    "Current Plan"
                  ) : (
                    <>
                      {currentPlan && Number(plan.price) > Number(currentPlan.price)
                        ? "Upgrade"
                        : "Downgrade"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Need Help Choosing */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Need Help Choosing?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Not sure which plan is right for you? Our team can help you find the perfect fit based
            on your usage patterns and needs.
          </p>
          <div className="flex gap-2">
            <Button variant="outline">Contact Support</Button>
            <Button variant="outline">View Comparison</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
