const React = require("react");

const Card = ({ children }) => React.createElement("div", {}, children);
Card.Header = ({ children }) => React.createElement("div", {}, children);
Card.Content = ({ children }) => React.createElement("div", {}, children);
Card.Title = ({ children }) => React.createElement("h3", {}, children);
Card.Description = ({ children }) => React.createElement("p", {}, children);

module.exports = {
  Button: ({ children, onClick, disabled, type, className, variant, size, ...props }) =>
    React.createElement("button", { onClick, disabled, type, className, ...props }, children),
  Card: Card,
  CardHeader: Card.Header,
  CardContent: Card.Content,
  CardTitle: Card.Title,
  Alert: ({ children }) => React.createElement("div", {}, children),
  Skeleton: () => React.createElement("div", {}, "Loading..."),
  Input: ({
    type,
    value,
    onChange,
    placeholder,
    className,
    required,
    disabled,
    id,
    name,
    ...props
  }) =>
    React.createElement("input", {
      type: type || "text",
      value,
      onChange,
      placeholder,
      className,
      required,
      disabled,
      id,
      name,
      ...props,
    }),
  Label: ({ children, htmlFor, className }) =>
    React.createElement("label", { htmlFor, className }, children),
  Select: ({ value, onChange, children, className, disabled, id, name, ...props }) =>
    React.createElement(
      "select",
      { value, onChange, className, disabled, id, name, ...props },
      children,
    ),
  Textarea: ({
    value,
    onChange,
    placeholder,
    className,
    required,
    disabled,
    id,
    name,
    rows,
    ...props
  }) =>
    React.createElement("textarea", {
      value,
      onChange,
      placeholder,
      className,
      required,
      disabled,
      id,
      name,
      rows: rows || 3,
      ...props,
    }),
  Checkbox: ({ checked, onChange, className, disabled, id, name, ...props }) =>
    React.createElement("input", {
      type: "checkbox",
      checked,
      onChange,
      className,
      disabled,
      id,
      name,
      ...props,
    }),
  Switch: ({ checked, onCheckedChange, disabled, className }) =>
    React.createElement(
      "button",
      {
        role: "switch",
        "aria-checked": checked,
        onClick: () => onCheckedChange && onCheckedChange(!checked),
        disabled,
        className,
      },
      checked ? "ON" : "OFF",
    ),
  Badge: ({ children, variant, className }) => React.createElement("span", { className }, children),
  Progress: ({ value, max, className }) =>
    React.createElement("progress", { value, max: max || 100, className }),
  Separator: ({ className, orientation }) => React.createElement("hr", { className }),
  Table: ({ children, className }) => React.createElement("table", { className }, children),
  TableHeader: ({ children }) => React.createElement("thead", {}, children),
  TableBody: ({ children }) => React.createElement("tbody", {}, children),
  TableRow: ({ children, className }) => React.createElement("tr", { className }, children),
  TableHead: ({ children, className }) => React.createElement("th", { className }, children),
  TableCell: ({ children, className }) => React.createElement("td", { className }, children),
  Dialog: ({ children, open, onOpenChange }) =>
    open ? React.createElement("div", { role: "dialog" }, children) : null,
  DialogContent: ({ children }) => React.createElement("div", {}, children),
  DialogHeader: ({ children }) => React.createElement("div", {}, children),
  DialogTitle: ({ children }) => React.createElement("h2", {}, children),
  DialogDescription: ({ children }) => React.createElement("p", {}, children),
  DialogFooter: ({ children }) => React.createElement("div", {}, children),
  Tabs: ({ children, defaultValue, value, onValueChange, className }) =>
    React.createElement("div", { className, "data-value": value || defaultValue }, children),
  TabsList: ({ children, className }) =>
    React.createElement("div", { role: "tablist", className }, children),
  TabsTrigger: ({ children, value, className }) =>
    React.createElement("button", { role: "tab", "data-value": value, className }, children),
  TabsContent: ({ children, value, className }) =>
    React.createElement("div", { role: "tabpanel", "data-value": value, className }, children),
};
