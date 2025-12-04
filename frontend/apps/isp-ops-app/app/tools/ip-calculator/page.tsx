"use client";

import { useMemo, useState } from "react";

const ipv4Cidr =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/([1-9]|[12]\d|3[0-2])$/;

function calculateHosts(cidr: number) {
  if (cidr <= 0 || cidr > 32) return 0;
  return Math.max(0, Math.pow(2, 32 - cidr) - 2);
}

export default function IPCalculatorPage() {
  const [value, setValue] = useState("192.0.2.0/24");
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => {
    if (!ipv4Cidr.test(value.trim())) return null;
    const [, cidr] = value.trim().split("/");
    return Number(cidr);
  }, [value]);

  const error = touched && !parsed ? "Enter a valid IPv4 CIDR (e.g., 192.0.2.0/24)" : "";

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
      <h1 className="text-2xl font-semibold">IP Calculator</h1>
      <p className="text-sm text-muted-foreground">
        Lightweight calculator used by E2E tests. Enter an IPv4 CIDR to see usable host counts.
      </p>

      <label htmlFor="cidr" className="text-sm font-medium text-foreground">
        CIDR Block
      </label>
      <input
        id="cidr"
        name="cidr"
        type="text"
        className="w-full rounded-md border border-border bg-background px-3 py-2"
        value={value}
        onBlur={() => setTouched(true)}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "cidr-calc-error" : undefined}
        placeholder="192.0.2.0/24"
      />
      {error && (
        <p id="cidr-calc-error" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {parsed && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Prefix length</div>
          <div className="text-xl font-semibold">{parsed}</div>
          <div className="text-sm text-muted-foreground">Usable hosts</div>
          <div className="text-xl font-semibold">{calculateHosts(parsed)}</div>
        </div>
      )}
    </main>
  );
}
