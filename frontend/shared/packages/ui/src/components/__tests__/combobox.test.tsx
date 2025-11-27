/**
 * Combobox Component Tests
 *
 * Tests searchable select component with single and multi-select variants
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Combobox, MultiCombobox, type ComboboxOption } from "../combobox";

describe("Combobox", () => {
  const options: ComboboxOption[] = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "cherry", label: "Cherry" },
    { value: "date", label: "Date" },
    { value: "elderberry", label: "Elderberry" },
  ];

  describe("Basic Rendering", () => {
    it("renders combobox button", () => {
      render(<Combobox options={options} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays placeholder when no value selected", () => {
      render(<Combobox options={options} placeholder="Choose fruit..." />);

      expect(screen.getByText("Choose fruit...")).toBeInTheDocument();
    });

    it("displays selected value label", () => {
      render(<Combobox options={options} value="apple" />);

      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    it("renders chevron icon", () => {
      const { container } = render(<Combobox options={options} />);

      const chevron = container.querySelector("svg");
      expect(chevron).toBeInTheDocument();
    });

    it("can be disabled", () => {
      render(<Combobox options={options} disabled />);

      const button = screen.getByRole("combobox");
      expect(button).toBeDisabled();
    });
  });

  describe("Opening and Closing", () => {
    it("opens dropdown when clicked", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      });
    });

    it("displays all options when opened", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Apple")).toBeInTheDocument();
        expect(screen.getByText("Banana")).toBeInTheDocument();
        expect(screen.getByText("Cherry")).toBeInTheDocument();
      });
    });

    it("closes dropdown when option is selected", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(<Combobox options={options} onValueChange={onValueChange} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Apple")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Apple"));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
      });
    });

    it("shows aria-expanded state", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveAttribute("aria-expanded", "false");

      await user.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-expanded", "true");
      });
    });
  });

  describe("Selection", () => {
    it("calls onValueChange when option is selected", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(<Combobox options={options} onValueChange={onValueChange} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Banana")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Banana"));

      expect(onValueChange).toHaveBeenCalledWith("banana");
    });

    it("shows check mark on selected option", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} value="cherry" />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const allCherryElements = screen.getAllByText("Cherry");
        const cherryOption = allCherryElements.find((el) => el.closest("[role='option']"));
        const checkMark = cherryOption?.closest("[role='option']")?.querySelector("svg");
        expect(checkMark).toHaveClass("opacity-100");
      });
    });

    it("hides check mark on unselected options", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} value="cherry" />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const allAppleElements = screen.getAllByText("Apple");
        const appleOption = allAppleElements.find((el) => el.closest("[role='option']"));
        const checkMark = appleOption?.closest("[role='option']")?.querySelector("svg");
        expect(checkMark).toHaveClass("opacity-0");
      });
    });

    it("deselects when same option is clicked", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(<Combobox options={options} value="apple" onValueChange={onValueChange} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
      });

      const allAppleElements = screen.getAllByText("Apple");
      const appleOption = allAppleElements.find((el) => el.closest("[role='option']"));
      await user.click(appleOption!);

      expect(onValueChange).toHaveBeenCalledWith("");
    });
  });

  describe("Search Functionality", () => {
    it("renders search input", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} searchPlaceholder="Type to search..." />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Type to search...")).toBeInTheDocument();
      });
    });

    it("filters options based on search", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "berry");

      // Should show elderberry but not apple
      expect(screen.getByText("Elderberry")).toBeInTheDocument();
    });

    it("shows empty state when no results", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} emptyText="Nothing found" />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "xyz123");

      await waitFor(() => {
        expect(screen.getByText("Nothing found")).toBeInTheDocument();
      });
    });
  });

  describe("Disabled Options", () => {
    it("renders disabled options", async () => {
      const user = userEvent.setup();
      const optionsWithDisabled: ComboboxOption[] = [
        { value: "apple", label: "Apple" },
        { value: "banana", label: "Banana", disabled: true },
      ];

      render(<Combobox options={optionsWithDisabled} />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Banana")).toBeInTheDocument();
      });
    });

    it("cannot select disabled option", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();
      const optionsWithDisabled: ComboboxOption[] = [
        { value: "apple", label: "Apple" },
        { value: "banana", label: "Banana", disabled: true },
      ];

      render(<Combobox options={optionsWithDisabled} onValueChange={onValueChange} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("Banana")).toBeInTheDocument();
      });

      // Try to click disabled option
      await user.click(screen.getByText("Banana"));

      // Should not trigger value change
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("Custom Props", () => {
    it("supports custom className", () => {
      render(<Combobox options={options} className="custom-combobox" />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveClass("custom-combobox");
    });

    it("uses custom placeholder", () => {
      render(<Combobox options={options} placeholder="Pick a fruit" />);

      expect(screen.getByText("Pick a fruit")).toBeInTheDocument();
    });

    it("uses custom search placeholder", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} searchPlaceholder="Find fruit..." />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Find fruit...")).toBeInTheDocument();
      });
    });

    it("uses custom empty text", async () => {
      const user = userEvent.setup();
      render(<Combobox options={options} emptyText="No fruits available" />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "xyz");

      await waitFor(() => {
        expect(screen.getByText("No fruits available")).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders country selector", async () => {
      const user = userEvent.setup();
      const countries: ComboboxOption[] = [
        { value: "us", label: "United States" },
        { value: "uk", label: "United Kingdom" },
        { value: "ca", label: "Canada" },
      ];

      render(<Combobox options={countries} placeholder="Select country..." />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("United States")).toBeInTheDocument();
        expect(screen.getByText("Canada")).toBeInTheDocument();
      });
    });

    it("renders language selector", async () => {
      const languages: ComboboxOption[] = [
        { value: "en", label: "English" },
        { value: "es", label: "Spanish" },
        { value: "fr", label: "French" },
      ];

      render(<Combobox options={languages} value="en" placeholder="Choose language..." />);

      expect(screen.getByText("English")).toBeInTheDocument();
    });

    it("renders framework selector with search", async () => {
      const user = userEvent.setup();
      const frameworks: ComboboxOption[] = [
        { value: "react", label: "React" },
        { value: "vue", label: "Vue" },
        { value: "angular", label: "Angular" },
        { value: "svelte", label: "Svelte" },
      ];

      render(<Combobox options={frameworks} searchPlaceholder="Search frameworks..." />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search frameworks...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search frameworks...");
      await user.type(searchInput, "react");

      expect(screen.getByText("React")).toBeInTheDocument();
    });
  });
});

describe("MultiCombobox", () => {
  const options: ComboboxOption[] = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
  ];

  describe("Basic Rendering", () => {
    it("renders multi-select combobox", () => {
      render(<MultiCombobox options={options} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays placeholder when no values selected", () => {
      render(<MultiCombobox options={options} placeholder="Select frameworks..." />);

      expect(screen.getByText("Select frameworks...")).toBeInTheDocument();
    });

    it("displays count when items selected", () => {
      render(<MultiCombobox options={options} value={["react", "vue"]} />);

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("can be disabled", () => {
      render(<MultiCombobox options={options} disabled />);

      const button = screen.getByRole("combobox");
      expect(button).toBeDisabled();
    });
  });

  describe("Multi-Selection", () => {
    it("allows selecting multiple options", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(<MultiCombobox options={options} value={[]} onValueChange={onValueChange} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getAllByText("React").length).toBeGreaterThan(0);
      });

      const reactElements = screen.getAllByText("React");
      const reactOption = reactElements.find((el) => el.closest("[role='option']"));
      await user.click(reactOption!);
      expect(onValueChange).toHaveBeenCalledWith(["react"]);

      // Reopen and select another
      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getAllByText("Vue").length).toBeGreaterThan(0);
      });

      const vueElements = screen.getAllByText("Vue");
      const vueOption = vueElements.find((el) => el.closest("[role='option']"));
      await user.click(vueOption!);
      expect(onValueChange).toHaveBeenCalledWith(["react", "vue"]);
    });

    it("shows check marks on selected options", async () => {
      const user = userEvent.setup();
      render(<MultiCombobox options={options} value={["react", "vue"]} />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        const reactOption = screen.getByText("React").closest("[role='option']");
        const reactCheck = reactOption?.querySelector("svg");
        expect(reactCheck).toHaveClass("opacity-100");

        const vueOption = screen.getByText("Vue").closest("[role='option']");
        const vueCheck = vueOption?.querySelector("svg");
        expect(vueCheck).toHaveClass("opacity-100");

        const angularOption = screen.getByText("Angular").closest("[role='option']");
        const angularCheck = angularOption?.querySelector("svg");
        expect(angularCheck).toHaveClass("opacity-0");
      });
    });

    it("deselects when selected option is clicked", async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <MultiCombobox options={options} value={["react", "vue"]} onValueChange={onValueChange} />,
      );

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("React")).toBeInTheDocument();
      });

      await user.click(screen.getByText("React"));

      expect(onValueChange).toHaveBeenCalledWith(["vue"]);
    });

    it("keeps dropdown open after selection", async () => {
      const user = userEvent.setup();
      render(<MultiCombobox options={options} value={[]} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByText("React")).toBeInTheDocument();
      });

      await user.click(screen.getByText("React"));

      // Dropdown should stay open
      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });
  });

  describe("Display Count", () => {
    it("shows 0 selected as placeholder", () => {
      render(<MultiCombobox options={options} value={[]} placeholder="Choose..." />);

      expect(screen.getByText("Choose...")).toBeInTheDocument();
    });

    it("shows 1 selected", () => {
      render(<MultiCombobox options={options} value={["react"]} />);

      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("shows 3 selected", () => {
      render(<MultiCombobox options={options} value={["react", "vue", "angular"]} />);

      expect(screen.getByText("3 selected")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("filters options in multi-select", async () => {
      const user = userEvent.setup();
      render(<MultiCombobox options={options} />);

      await user.click(screen.getByRole("combobox"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "vue");

      expect(screen.getByText("Vue")).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders tag selector", async () => {
      const user = userEvent.setup();
      const tags: ComboboxOption[] = [
        { value: "bug", label: "Bug" },
        { value: "feature", label: "Feature" },
        { value: "enhancement", label: "Enhancement" },
        { value: "documentation", label: "Documentation" },
      ];

      render(<MultiCombobox options={tags} placeholder="Select tags..." />);

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Bug")).toBeInTheDocument();
        expect(screen.getByText("Feature")).toBeInTheDocument();
      });
    });

    it("renders skill selector", () => {
      const skills: ComboboxOption[] = [
        { value: "js", label: "JavaScript" },
        { value: "ts", label: "TypeScript" },
        { value: "react", label: "React" },
        { value: "node", label: "Node.js" },
      ];

      render(<MultiCombobox options={skills} value={["js", "react"]} />);

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("renders multi-language selector", async () => {
      const user = userEvent.setup();
      const languages: ComboboxOption[] = [
        { value: "en", label: "English" },
        { value: "es", label: "Spanish" },
        { value: "fr", label: "French" },
        { value: "de", label: "German" },
      ];

      render(
        <MultiCombobox options={languages} value={["en"]} placeholder="Select languages..." />,
      );

      expect(screen.getByText("1 selected")).toBeInTheDocument();

      await user.click(screen.getByRole("combobox"));

      await waitFor(() => {
        expect(screen.getByText("Spanish")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has combobox role", () => {
      render(<MultiCombobox options={options} />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveAttribute("role", "combobox");
    });

    it("shows aria-expanded state", async () => {
      const user = userEvent.setup();
      render(<MultiCombobox options={options} />);

      const button = screen.getByRole("combobox");
      expect(button).toHaveAttribute("aria-expanded", "false");

      await user.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-expanded", "true");
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty options array", () => {
      render(<MultiCombobox options={[]} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("handles undefined value", () => {
      render(<MultiCombobox options={options} value={undefined} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("handles selection of all options", () => {
      render(<MultiCombobox options={options} value={["react", "vue", "angular", "svelte"]} />);

      expect(screen.getByText("4 selected")).toBeInTheDocument();
    });
  });
});
