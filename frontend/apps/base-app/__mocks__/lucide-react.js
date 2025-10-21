const React = require("react");

// Mock lucide-react icons
const mockIcon = ({ className, ...props }) =>
  React.createElement("svg", {
    className,
    "data-testid": "mock-icon",
    ...props,
  });

module.exports = new Proxy(
  {},
  {
    get: () => mockIcon,
  },
);

// For named exports
const iconNames = [
  "Puzzle",
  "Plus",
  "Settings",
  "CheckCircle",
  "XCircle",
  "AlertTriangle",
  "RefreshCw",
  "Trash2",
  "Edit",
  "Eye",
  "TestTube",
  "Activity",
  "Search",
  "Filter",
  "User",
  "Mail",
  "Lock",
  "Bell",
  "Shield",
  "Globe",
  "Moon",
  "Sun",
  "Monitor",
  "Palette",
  "Database",
  "Key",
  "AlertCircle",
  "Save",
  "EyeOff",
  "Upload",
  "Calendar",
  "Clock",
  "TrendingUp",
  "TrendingDown",
  "Zap",
  "Info",
  "ExternalLink",
  "Tag",
  "Users",
  "Loader2",
  "X",
];

iconNames.forEach((name) => {
  module.exports[name] = mockIcon;
});
