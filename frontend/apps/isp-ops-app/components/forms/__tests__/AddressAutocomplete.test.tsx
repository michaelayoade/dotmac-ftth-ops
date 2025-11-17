/**
 * AddressAutocomplete Wrapper Tests
 *
 * Ensures ISP Ops wrapper forwards props and injects the shared `cn` helper.
 */

import React from "react";
import { render } from "@testing-library/react";
import { AddressAutocompleteWrapper } from "../AddressAutocomplete";

const mockSharedAutocomplete = jest.fn(() => <div data-testid="shared-autocomplete" />);
jest.mock("@dotmac/features/forms", () => ({
  AddressAutocomplete: (props: any) => mockSharedAutocomplete(props),
}));

jest.mock("@/lib/utils", () => ({
  cn: jest.fn((...classes: string[]) => classes.filter(Boolean).join(" ")),
}));
const { cn: mockCn } = jest.requireMock("@/lib/utils");

describe("AddressAutocompleteWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards all props to the shared component", () => {
    const onChange = jest.fn();
    const onSelect = jest.fn();

    render(
      <AddressAutocompleteWrapper
        value="10 Downing Street"
        label="Service Address"
        placeholder="Search"
        onChange={onChange}
        onSelect={onSelect}
        required
        disabled
      />,
    );

    expect(mockSharedAutocomplete).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "10 Downing Street",
        label: "Service Address",
        placeholder: "Search",
        onChange,
        onSelect,
        required: true,
        disabled: true,
      }),
    );
  });

  it("injects the cn helper into the shared component", () => {
    render(<AddressAutocompleteWrapper />);

    const lastCall = mockSharedAutocomplete.mock.lastCall?.[0];
    expect(lastCall?.cn).toBeDefined();
    expect(lastCall?.cn).toBe(mockCn);
  });
});
