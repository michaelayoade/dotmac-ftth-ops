/**
 * Storybook Stories for Button Component
 *
 * Comprehensive documentation and examples for the Button component
 */

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "./Button";
import { Loader2, Download, Plus, Trash2 } from "lucide-react";

const meta = {
  title: "Primitives/Forms/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The Button component is a foundational interactive element that supports various styles, states, and behaviors. 
It includes built-in accessibility features, security considerations, and performance optimizations.

## Features
- Multiple visual variants (default, destructive, outline, secondary, ghost, link)
- Loading states with customizable indicators
- Icon support (left and right)
- Async operation handling
- Security-focused click handlers
- Full accessibility support
- TypeScript-first design

## Usage
\`\`\`tsx
import { Button } from '@dotmac/primitives';

<Button onClick={handleClick}>
  Click me
</Button>
\`\`\`
        `,
      },
    },
    security: {
      enableValidation: true,
      enableSanitization: true,
    },
    a11y: {
      config: {
        rules: [
          {
            id: "button-name",
            enabled: true,
          },
          {
            id: "color-contrast",
            enabled: true,
          },
        ],
      },
    },
  },
  tags: ["autodocs", "secure", "accessible"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      description: "Visual style variant of the button",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    size: {
      control: { type: "select" },
      options: ["sm", "default", "lg", "icon"],
      description: "Size of the button",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    isLoading: {
      control: "boolean",
      description: "Whether the button is in a loading state",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Whether the button is disabled",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showAsyncLoading: {
      control: "boolean",
      description: "Whether to show loading state during async operations",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    preventFormSubmission: {
      control: "boolean",
      description: "Whether to prevent form submission on click",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    type: {
      control: { type: "select" },
      options: ["button", "submit", "reset"],
      description: "Button type attribute",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "button" },
      },
    },
    onClick: {
      action: "clicked",
      description: "Click event handler",
      table: {
        type: { summary: "(event: MouseEvent) => void" },
      },
    },
    onSecureClick: {
      action: "secure-clicked",
      description: "Secure click event handler with built-in async support",
      table: {
        type: { summary: "(event: MouseEvent) => void | Promise<void>" },
      },
    },
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: "Button",
  },
};

// Variant stories
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
  parameters: {
    docs: {
      description: {
        story: "Destructive buttons are used for dangerous actions like deletion.",
      },
    },
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost",
  },
};

export const Link: Story = {
  args: {
    variant: "link",
    children: "Link",
  },
};

// Size stories
export const Small: Story = {
  args: {
    size: "sm",
    children: "Small",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large",
  },
};

export const Icon: Story = {
  args: {
    size: "icon",
    children: <Plus className="h-4 w-4" />,
    "aria-label": "Add item",
  },
  parameters: {
    docs: {
      description: {
        story: "Icon-only buttons must include an aria-label for accessibility.",
      },
    },
  },
};

// State stories
export const Loading: Story = {
  args: {
    isLoading: true,
    children: "Loading",
  },
  parameters: {
    docs: {
      description: {
        story: "Loading state disables the button and shows a spinner.",
      },
    },
  },
};

export const LoadingCustom: Story = {
  args: {
    isLoading: true,
    loadingComponent: <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />,
    children: "Custom Loading",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the loading indicator.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled",
  },
};

// Icon stories
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Download className="h-4 w-4" />,
    children: "Download",
  },
  parameters: {
    docs: {
      description: {
        story: "Buttons can include icons on the left side.",
      },
    },
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <Plus className="h-4 w-4" />,
    children: "Add Item",
  },
};

export const DestructiveWithIcon: Story = {
  args: {
    variant: "destructive",
    leftIcon: <Trash2 className="h-4 w-4" />,
    children: "Delete",
  },
  parameters: {
    docs: {
      description: {
        story: "Destructive actions often benefit from warning icons.",
      },
    },
  },
};

// Async operation story
export const AsyncOperation: Story = {
  args: {
    children: "Save Changes",
    onSecureClick: async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Changes saved successfully");
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates automatic loading state during async operations using onSecureClick.",
      },
    },
  },
};

// Form prevention story
export const FormPrevention: Story = {
  args: {
    children: "Prevent Submit",
    preventFormSubmission: true,
    type: "submit",
  },
  render: (args) => (
    <form
      onSubmit={(e) => {
        console.log("Form would have been submitted");
        alert("Form submission prevented!");
      }}
    >
      <p>Click the button - form submission will be prevented:</p>
      <Button {...args} />
    </form>
  ),
  parameters: {
    docs: {
      description: {
        story: "Button can prevent form submission when needed.",
      },
    },
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All button variants displayed together for comparison.",
      },
    },
  },
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Icon button">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All button sizes displayed together for comparison.",
      },
    },
  },
};

// Loading states showcase
export const LoadingStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button isLoading>Loading Default</Button>
      <Button isLoading variant="destructive">
        Loading Destructive
      </Button>
      <Button isLoading variant="outline">
        Loading Outline
      </Button>
      <Button isLoading size="sm">
        Loading Small
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Loading states across different variants and sizes.",
      },
    },
  },
};

// Accessibility showcase
export const AccessibilityShowcase: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Proper Labeling</h3>
        <div className="flex gap-4">
          <Button>Text Button</Button>
          <Button size="icon" aria-label="Close dialog">
            ×
          </Button>
          <Button leftIcon={<Download className="h-4 w-4" />}>Download File</Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">States</h3>
        <div className="flex gap-4">
          <Button>Normal</Button>
          <Button disabled>Disabled</Button>
          <Button isLoading>Loading</Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Interactive</h3>
        <div className="flex gap-4">
          <Button onClick={() => alert("Primary action")}>Primary Action</Button>
          <Button variant="destructive" onClick={() => confirm("Are you sure?")}>
            Confirm Action
          </Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Demonstrates proper accessibility patterns for buttons.",
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "button-name", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "focus-order", enabled: true },
        ],
      },
    },
  },
};

// Performance showcase
export const PerformanceShowcase: Story = {
  render: () => {
    const handleExpensiveOperation = async () => {
      console.time("Expensive operation");
      // Simulate expensive operation
      const result = Array.from({ length: 100000 }, (_, i) => i * i);
      console.log(`Processed ${result.length} items`);
      console.timeEnd("Expensive operation");
    };

    return (
      <div className="space-y-4">
        <p>These buttons demonstrate performance considerations:</p>
        <div className="flex gap-4">
          <Button onSecureClick={handleExpensiveOperation} showAsyncLoading>
            Expensive Operation (Auto Loading)
          </Button>

          <Button onClick={handleExpensiveOperation} showAsyncLoading={false}>
            Expensive Operation (No Loading)
          </Button>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates performance considerations and loading state management.",
      },
    },
    performance: {
      allowedGroups: ["interaction", "measure"],
    },
  },
};
