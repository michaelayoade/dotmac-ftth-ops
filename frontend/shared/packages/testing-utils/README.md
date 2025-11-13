# @dotmac/testing-utils

Shared helpers for writing tests in the DotMac workspace.

## Radix Select mocks

When you need to stub the Radix `Select` components shipped via `@dotmac/ui`, import the lightweight mock bundle:

```ts
vi.mock("@dotmac/ui", async () => {
  const actual = await vi.importActual("@dotmac/ui");
  const { simpleSelectMocks } = await import("@dotmac/testing-utils/react/simpleSelectMocks");

  return {
    ...actual,
    ...simpleSelectMocks,
    // other component overrides
  };
});
```

The `simpleSelectMocks` factory provides DOM-friendly implementations of `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, and `SelectValue`, preventing invalid nesting warnings in jsdom.
