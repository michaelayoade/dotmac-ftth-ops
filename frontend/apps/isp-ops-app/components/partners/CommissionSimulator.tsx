"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Calculator, TrendingUp, DollarSign, Percent } from "lucide-react";

type CommissionModel = "revenue_share" | "flat_fee" | "tiered" | "hybrid";

interface TierConfig {
  min_volume: number;
  max_volume: number | null;
  rate: number;
}

interface SimulationResult {
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  effectiveRate: number;
  model: CommissionModel;
  tier?: string;
}

export function CommissionSimulator() {
  const [model, setModel] = useState<CommissionModel>("revenue_share");
  const [baseAmount, setBaseAmount] = useState<string>("1000");
  const [revenueShareRate, setRevenueShareRate] = useState<string>("10");
  const [flatFeeAmount, setFlatFeeAmount] = useState<string>("50");
  const [volume, setVolume] = useState<string>("5000");
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Example tiered configuration
  const tierConfig: TierConfig[] = [
    { min_volume: 0, max_volume: 5000, rate: 5 },
    { min_volume: 5000, max_volume: 10000, rate: 7.5 },
    { min_volume: 10000, max_volume: 25000, rate: 10 },
    { min_volume: 25000, max_volume: null, rate: 12.5 },
  ];

  const calculateCommission = () => {
    const base = parseFloat(baseAmount) || 0;
    const vol = parseFloat(volume) || 0;

    let commission = 0;
    let rate = 0;
    let tier = "";

    switch (model) {
      case "revenue_share":
        rate = parseFloat(revenueShareRate) || 0;
        commission = base * (rate / 100);
        break;

      case "flat_fee":
        commission = parseFloat(flatFeeAmount) || 0;
        rate = base > 0 ? (commission / base) * 100 : 0;
        break;

      case "tiered":
        // Find applicable tier based on volume
        const applicableTier = tierConfig.find((t) => {
          const inRange = vol >= t.min_volume && (t.max_volume === null || vol < t.max_volume);
          return inRange;
        });

        if (applicableTier) {
          rate = applicableTier.rate;
          commission = base * (rate / 100);
          const maxVol = applicableTier.max_volume
            ? applicableTier.max_volume.toLocaleString()
            : "∞";
          tier = `$${applicableTier.min_volume.toLocaleString()} - $${maxVol}`;
        }
        break;

      case "hybrid":
        // Combination of revenue share and flat fee
        const percentRate = parseFloat(revenueShareRate) || 0;
        const flat = parseFloat(flatFeeAmount) || 0;
        const percentComponent = base * (percentRate / 100);
        commission = percentComponent + flat;
        rate = base > 0 ? (commission / base) * 100 : 0;
        break;
    }

    setResult({
      baseAmount: base,
      commissionRate: rate,
      commissionAmount: commission,
      effectiveRate: rate,
      model,
      tier,
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Input Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Commission Calculator
          </CardTitle>
          <CardDescription>Simulate commission earnings based on different models</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Commission Model */}
          <div className="space-y-2">
            <Label>Commission Model</Label>
            <Select value={model} onValueChange={(value) => setModel(value as CommissionModel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue_share">Revenue Share (Percentage)</SelectItem>
                <SelectItem value="flat_fee">Flat Fee</SelectItem>
                <SelectItem value="tiered">Tiered (Volume-based)</SelectItem>
                <SelectItem value="hybrid">Hybrid (Percentage + Flat Fee)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Base Amount */}
          <div className="space-y-2">
            <Label htmlFor="baseAmount">Invoice/Revenue Amount ($)</Label>
            <Input
              id="baseAmount"
              type="number"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="1000"
            />
          </div>

          {/* Model-specific inputs */}
          {(model === "revenue_share" || model === "hybrid") && (
            <div className="space-y-2">
              <Label htmlFor="rate">Commission Rate (%)</Label>
              <Input
                id="rate"
                type="number"
                value={revenueShareRate}
                onChange={(e) => setRevenueShareRate(e.target.value)}
                placeholder="10"
                step="0.1"
              />
            </div>
          )}

          {(model === "flat_fee" || model === "hybrid") && (
            <div className="space-y-2">
              <Label htmlFor="flatFee">Flat Fee Amount ($)</Label>
              <Input
                id="flatFee"
                type="number"
                value={flatFeeAmount}
                onChange={(e) => setFlatFeeAmount(e.target.value)}
                placeholder="50"
              />
            </div>
          )}

          {model === "tiered" && (
            <div className="space-y-2">
              <Label htmlFor="volume">Total Volume ($)</Label>
              <Input
                id="volume"
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="5000"
              />
              <p className="text-xs text-muted-foreground mt-2">Tier structure:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {tierConfig.map((tier, idx) => (
                  <li key={idx}>
                    ${tier.min_volume.toLocaleString()} - $
                    {tier.max_volume?.toLocaleString() || "∞"}: {tier.rate}%
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={calculateCommission} className="w-full">
            <Calculator className="h-4 w-4 mr-2" />
            Calculate Commission
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Calculation Results
          </CardTitle>
          <CardDescription>Commission breakdown and earnings estimate</CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-6">
              {/* Commission Amount */}
              <div className="p-6 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-sm text-muted-foreground mb-2">Estimated Commission</div>
                <div className="text-4xl font-bold text-primary flex items-center gap-2">
                  <DollarSign className="h-8 w-8" />
                  {result.commissionAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Base Amount</span>
                  <span className="text-sm font-medium">${result.baseAmount.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Effective Rate
                  </span>
                  <span className="text-sm font-medium">{result.effectiveRate.toFixed(2)}%</span>
                </div>

                {result.tier && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm text-muted-foreground">Applicable Tier</span>
                    <span className="text-sm font-medium">{result.tier}</span>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Commission Model</span>
                  <span className="text-sm font-medium capitalize">
                    {result.model.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Example Projections */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-semibold mb-3">Monthly Projections</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">10 transactions/month:</span>
                    <span className="font-medium">
                      $
                      {(result.commissionAmount * 10).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">25 transactions/month:</span>
                    <span className="font-medium">
                      $
                      {(result.commissionAmount * 25).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">50 transactions/month:</span>
                    <span className="font-medium">
                      $
                      {(result.commissionAmount * 50).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Configure your parameters and click Calculate to see results</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
