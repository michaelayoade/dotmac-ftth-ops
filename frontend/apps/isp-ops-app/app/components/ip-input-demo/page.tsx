"use client";

import { useMemo, useState } from "react";

const validateIp = (value: string) => {
  // Simple IPv4 validator; enough for demo purposes
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return ipv4Regex.test(value.trim());
};

export default function IPInputDemoPage() {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const error = useMemo(() => {
    if (!touched) return "";
    if (!value) return "IP address is required";
    if (!validateIp(value)) return "Invalid IP address";
    return "";
  }, [touched, value]);

  const errorId = error ? "ip-input-error" : undefined;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
      <h1 className="text-2xl font-semibold">IP Address Input Demo</h1>
      <p className="text-sm text-muted-foreground">
        Simple demo form used by automated accessibility tests.
      </p>

      <form className="space-y-3" noValidate>
        <label htmlFor="ip" className="text-sm font-medium text-foreground">
          IP Address
        </label>
        <input
          id="ip"
          name="ip"
          data-testid="ip-address-input"
          type="text"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="192.0.2.1"
          value={value}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          onBlur={() => setTouched(true)}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-500">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
