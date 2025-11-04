/**
 * Storybook Stories for Input Component
 *
 * Comprehensive documentation and examples for the Input component
 */

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Input } from "./Input";
import { Mail, Search, Lock, User, Eye, EyeOff } from "lucide-react";

const meta = {
  title: "Primitives/Forms/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The Input component is a comprehensive form input element with built-in validation, 
security features, and accessibility support. It handles various input types and states.

## Features
- Multiple visual variants (default, error, success, warning)
- Built-in validation and sanitization
- Password visibility toggle
- Icon support (left and right)
- Character counting
- Loading states
- Full accessibility support
- Security-first design

## Usage
\`\`\`tsx
import { Input } from '@dotmac/primitives';

<Input
  label="Email"
  type="email"
  placeholder="Enter your email"
  onChange={handleChange}
/>
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
          { id: "label", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "aria-valid-attr-value", enabled: true },
        ],
      },
    },
  },
  tags: ["autodocs", "secure", "accessible"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "error", "success", "warning"],
      description: "Visual style variant of the input",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    size: {
      control: { type: "select" },
      options: ["sm", "default", "lg"],
      description: "Size of the input",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    type: {
      control: { type: "select" },
      options: ["text", "email", "password", "tel", "url", "search", "number"],
      description: "Input type",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "text" },
      },
    },
    label: {
      control: "text",
      description: "Label text for the input",
      table: {
        type: { summary: "string" },
      },
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
      table: {
        type: { summary: "string" },
      },
    },
    helperText: {
      control: "text",
      description: "Helper text displayed below the input",
      table: {
        type: { summary: "string" },
      },
    },
    error: {
      control: "text",
      description: "Error message to display",
      table: {
        type: { summary: "string" },
      },
    },
    success: {
      control: "text",
      description: "Success message to display",
      table: {
        type: { summary: "string" },
      },
    },
    warning: {
      control: "text",
      description: "Warning message to display",
      table: {
        type: { summary: "string" },
      },
    },
    isLoading: {
      control: "boolean",
      description: "Whether the input is in a loading state",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    required: {
      control: "boolean",
      description: "Whether the input is required",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showPasswordToggle: {
      control: "boolean",
      description: "Whether to show password visibility toggle",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    sanitize: {
      control: "boolean",
      description: "Whether to sanitize input",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    validateOnBlur: {
      control: "boolean",
      description: "Whether to validate on blur",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    validateOnChange: {
      control: "boolean",
      description: "Whether to validate on change",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    maxLength: {
      control: "number",
      description: "Maximum character count",
      table: {
        type: { summary: "number" },
      },
    },
    showCharCount: {
      control: "boolean",
      description: "Whether to show character count",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onChange: {
      action: "changed",
      description: "Change event handler",
      table: {
        type: { summary: "(event: ChangeEvent) => void" },
      },
    },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

// With Label
export const WithLabel: Story = {
  args: {
    label: "Username",
    placeholder: "Enter your username",
  },
};

// Required field
export const Required: Story = {
  args: {
    label: "Email Address",
    type: "email",
    placeholder: "user@example.com",
    required: true,
    helperText: "We&apos;ll never share your email with anyone else.",
  },
  parameters: {
    docs: {
      description: {
        story: "Required fields show an asterisk (*) indicator and proper aria attributes.",
      },
    },
  },
};

// Password input
export const Password: Story = {
  args: {
    label: "Password",
    type: "password",
    placeholder: "Enter your password",
    showPasswordToggle: true,
    helperText: "Must be at least 8 characters long",
  },
  parameters: {
    docs: {
      description: {
        story: "Password inputs can include a visibility toggle for better UX.",
      },
    },
  },
};

// Variant stories
export const ErrorState: Story = {
  args: {
    label: "Username",
    placeholder: "Enter username",
    error: "Username is already taken",
    value: "invalid_user",
  },
  parameters: {
    docs: {
      description: {
        story: "Error state with validation message and visual indicators.",
      },
    },
  },
};

export const SuccessState: Story = {
  args: {
    label: "Username",
    placeholder: "Enter username",
    success: "Username is available!",
    value: "valid_user",
  },
};

export const WarningState: Story = {
  args: {
    label: "Password",
    type: "password",
    warning: "Password strength: Medium",
    value: "mypassword",
  },
};

// Size variants
export const Small: Story = {
  args: {
    size: "sm",
    label: "Small Input",
    placeholder: "Small size",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    label: "Large Input",
    placeholder: "Large size",
  },
};

// Input types
export const EmailInput: Story = {
  args: {
    type: "email",
    label: "Email Address",
    placeholder: "user@example.com",
    leftIcon: <Mail className="h-4 w-4" />,
  },
};

export const SearchInput: Story = {
  args: {
    type: "search",
    placeholder: "Search...",
    leftIcon: <Search className="h-4 w-4" />,
  },
};

export const PhoneInput: Story = {
  args: {
    type: "tel",
    label: "Phone Number",
    placeholder: "+1 (555) 123-4567",
  },
};

// With icons
export const WithLeftIcon: Story = {
  args: {
    label: "Username",
    placeholder: "Enter username",
    leftIcon: <User className="h-4 w-4" />,
  },
};

export const WithRightIcon: Story = {
  args: {
    label: "Search",
    placeholder: "Type to search...",
    rightIcon: <Search className="h-4 w-4" />,
  },
};

export const WithBothIcons: Story = {
  args: {
    label: "Secure Search",
    placeholder: "Search securely...",
    leftIcon: <Lock className="h-4 w-4" />,
    rightIcon: <Search className="h-4 w-4" />,
  },
};

// Loading state
export const Loading: Story = {
  args: {
    label: "Processing",
    placeholder: "Please wait...",
    isLoading: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Loading state disables the input and shows a loading overlay.",
      },
    },
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    label: "Disabled Input",
    placeholder: "This is disabled",
    value: "Cannot edit this",
    disabled: true,
  },
};

// Character counting
export const WithCharacterCount: Story = {
  args: {
    label: "Bio",
    placeholder: "Tell us about yourself...",
    maxLength: 100,
    showCharCount: true,
    helperText: "Describe yourself in 100 characters or less",
  },
};

export const CharacterLimitExceeded: Story = {
  args: {
    label: "Short Description",
    maxLength: 10,
    showCharCount: true,
    value: "This text is way too long for the limit",
  },
  parameters: {
    docs: {
      description: {
        story: "When character limit is exceeded, the counter turns red.",
      },
    },
  },
};

// Validation examples
export const ValidationOnBlur: Story = {
  args: {
    label: "Email",
    type: "email",
    placeholder: "Enter email",
    validateOnBlur: true,
    validate: (value: string) => {
      if (!value) return "Email is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address";
      }
      return null;
    },
    helperText: "Email will be validated when you click away",
  },
};

export const ValidationOnChange: Story = {
  args: {
    label: "Username",
    placeholder: "Enter username",
    validateOnChange: true,
    validate: (value: string) => {
      if (!value) return "Username is required";
      if (value.length < 3) return "Username must be at least 3 characters";
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        return "Username can only contain letters, numbers, and underscores";
      }
      return null;
    },
    helperText: "Username is validated as you type",
  },
};

// Security demonstration
export const SecurityDemo: Story = {
  args: {
    label: "Secure Input",
    placeholder: 'Try entering <script>alert("xss")</script>',
    sanitize: true,
    helperText: "This input sanitizes dangerous content automatically",
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates automatic input sanitization to prevent XSS attacks.",
      },
    },
  },
};

// Form example
export const CompleteForm: Story = {
  render: () => (
    <form className="space-y-6 w-96">
      <Input
        label="Full Name"
        placeholder="Enter your full name"
        required
        leftIcon={<User className="h-4 w-4" />}
      />

      <Input
        label="Email Address"
        type="email"
        placeholder="user@example.com"
        required
        leftIcon={<Mail className="h-4 w-4" />}
      />

      <Input
        label="Password"
        type="password"
        placeholder="Enter secure password"
        required
        showPasswordToggle
        leftIcon={<Lock className="h-4 w-4" />}
        helperText="Must be at least 8 characters with uppercase, lowercase, number, and symbol"
      />

      <Input
        label="Bio"
        placeholder="Tell us about yourself..."
        maxLength={200}
        showCharCount
        helperText="Optional: Share a brief bio"
      />

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
      >
        Create Account
      </button>
    </form>
  ),
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story: "Complete form example showing various input configurations.",
      },
    },
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <Input label="Default" placeholder="Default variant" />

      <Input label="Error" variant="error" error="This field has an error" value="Invalid input" />

      <Input label="Success" variant="success" success="This looks good!" value="Valid input" />

      <Input
        label="Warning"
        variant="warning"
        warning="Please double-check this"
        value="Questionable input"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All input variants displayed together for comparison.",
      },
    },
  },
};

// Accessibility showcase
export const AccessibilityShowcase: Story = {
  render: () => (
    <div className="space-y-6 w-96">
      <div>
        <h3 className="text-lg font-semibold mb-4">Proper Labeling</h3>
        <div className="space-y-4">
          <Input
            label="Accessible Label"
            placeholder="Input with proper label"
            helperText="This input has proper labeling"
          />

          <Input
            placeholder="Input with aria-label"
            aria-label="Search products"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Error Handling</h3>
        <Input
          label="Required Field"
          required
          error="This field is required"
          helperText="Error messages are announced to screen readers"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Complex Input</h3>
        <Input
          label="Password"
          type="password"
          required
          showPasswordToggle
          helperText="Password visibility can be toggled"
          aria-describedby="password-help"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Demonstrates proper accessibility patterns for input fields.",
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "label", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "aria-valid-attr-value", enabled: true },
          { id: "form-field-multiple-labels", enabled: true },
        ],
      },
    },
  },
};
