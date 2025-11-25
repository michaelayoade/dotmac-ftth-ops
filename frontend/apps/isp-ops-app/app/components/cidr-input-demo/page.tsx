"use client";

import { useMemo, useState } from "react";

const validateCidr = (value: string) => {
  const cidrRegex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/([1-9]|[12]\d|3[0-2])$/;
  return cidrRegex.test(value.trim());
};

export default function CIDRInputDemoPage() {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const error = useMemo(() => {
    if (!touched) return "";
    if (!value) return "CIDR is required";
    if (!validateCidr(value)) return "Invalid CIDR";
    return "";
  }, [touched, value]);

  const errorId = error ? "cidr-input-error" : undefined;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
      <h1 className="text-2xl font-semibold">CIDR Input Demo</h1>
      <p className="text-sm text-muted-foreground">
        Enter an IPv4 CIDR (e.g., 192.0.2.0/24) to validate input semantics.
      </p>

      <form className="space-y-3" noValidate>
        <label htmlFor="cidr" className="text-sm font-medium text-foreground">
          CIDR Block
        </label>
        <input
          id="cidr"
          name="cidr"
          data-testid="cidr-input"
          type="text"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="192.0.2.0/24"
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
