"use client";

import { useState } from "react";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/([1-9]|[12]\d|3[0-2]))?$/;
const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(\/(\d|[1-9]\d|1[01]\d|12[0-8]))?$/i;

export default function DualStackDemoPage() {
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [touched, setTouched] = useState(false);

  const ipv4Error = touched && ipv4 && !ipv4Regex.test(ipv4.trim()) ? "Invalid IPv4 address" : "";
  const ipv6Error = touched && ipv6 && !ipv6Regex.test(ipv6.trim()) ? "Invalid IPv6 address" : "";

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-4" data-testid="dual-stack-input">
      <h1 className="text-2xl font-semibold">Dual Stack Input Demo</h1>
      <p className="text-sm text-muted-foreground">
        Provide IPv4 and IPv6 values to validate dual-stack inputs.
      </p>

      <form className="grid gap-6 md:grid-cols-2" noValidate>
        <div className="space-y-2">
          <label htmlFor="ipv4" className="text-sm font-medium text-foreground">
            IPv4 Address
          </label>
          <input
            id="ipv4"
            name="ipv4"
            type="text"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="192.0.2.10/24"
            value={ipv4}
            aria-describedby={ipv4Error ? "ipv4-error" : undefined}
            aria-invalid={Boolean(ipv4Error)}
            onBlur={() => setTouched(true)}
            onChange={(e) => setIpv4(e.target.value)}
          />
          {ipv4Error && (
            <p id="ipv4-error" className="text-sm text-red-500">
              {ipv4Error}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="ipv6" className="text-sm font-medium text-foreground">
            IPv6 Address
          </label>
          <input
            id="ipv6"
            name="ipv6"
            type="text"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="2001:db8::10/64"
            value={ipv6}
            aria-describedby={ipv6Error ? "ipv6-error" : undefined}
            aria-invalid={Boolean(ipv6Error)}
            onBlur={() => setTouched(true)}
            onChange={(e) => setIpv6(e.target.value)}
          />
          {ipv6Error && (
            <p id="ipv6-error" className="text-sm text-red-500">
              {ipv6Error}
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
