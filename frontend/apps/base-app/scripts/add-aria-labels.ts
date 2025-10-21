#!/usr/bin/env tsx
/**
 * Automated ARIA Label Addition Script
 *
 * Scans all TSX files and adds aria-label to buttons that don't have them.
 * Uses intelligent heuristics to generate appropriate labels.
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";

interface ButtonMatch {
  file: string;
  line: number;
  content: string;
  iconName?: string;
  suggestedLabel: string | undefined;
}

// Icon name to action mapping
const ICON_TO_ACTION: Record<string, string> = {
  // Edit actions
  Edit: "Edit",
  Edit2: "Edit",
  Edit3: "Edit",
  Pencil: "Edit",

  // Delete actions
  Trash: "Delete",
  Trash2: "Delete",
  X: "Close",
  XCircle: "Close",
  XSquare: "Close",

  // View actions
  Eye: "View",
  EyeOff: "Hide",

  // Navigation
  ChevronLeft: "Go back",
  ChevronRight: "Go forward",
  ChevronUp: "Scroll up",
  ChevronDown: "Scroll down",
  ArrowLeft: "Go back",
  ArrowRight: "Go forward",
  ArrowUp: "Move up",
  ArrowDown: "Move down",

  // Actions
  Download: "Download",
  Upload: "Upload",
  Save: "Save",
  Copy: "Copy",
  Check: "Confirm",
  CheckCircle: "Confirm",
  Plus: "Add",
  PlusCircle: "Add",
  Minus: "Remove",
  MinusCircle: "Remove",

  // Settings
  Settings: "Settings",
  Sliders: "Adjust settings",
  Filter: "Filter",
  Search: "Search",
  RefreshCw: "Refresh",
  RotateCw: "Rotate clockwise",
  RotateCcw: "Rotate counterclockwise",

  // Info
  Info: "More information",
  HelpCircle: "Help",
  AlertCircle: "Alert",
  AlertTriangle: "Warning",

  // Menu
  Menu: "Open menu",
  MoreVertical: "More options",
  MoreHorizontal: "More options",

  // Media
  Play: "Play",
  Pause: "Pause",
  Stop: "Stop",

  // File
  File: "File",
  FileText: "View file",
  Folder: "Open folder",
  FolderOpen: "Close folder",
};

function extractIconName(buttonContent: string): string | undefined {
  // Match <IconName /> or <IconName className=...
  const iconMatch = buttonContent.match(/<([A-Z][a-zA-Z0-9]+)\s*(?:className|\/)/);
  return iconMatch ? iconMatch[1] : undefined;
}

function generateLabel(buttonContent: string, context: string): string | undefined {
  // Check if already has aria-label
  if (buttonContent.includes("aria-label")) {
    return "";
  }

  // Extract icon name
  const iconName = extractIconName(buttonContent);

  if (iconName && ICON_TO_ACTION[iconName]) {
    return ICON_TO_ACTION[iconName];
  }

  // Try to infer from onClick handler name
  const onClickMatch = buttonContent.match(/onClick=\{([^}]+)\}/);
  if (onClickMatch) {
    const handlerName = onClickMatch[1];

    if (handlerName && (handlerName.includes("delete") || handlerName.includes("remove"))) {
      return "Delete";
    }
    if (handlerName && (handlerName.includes("edit") || handlerName.includes("update"))) {
      return "Edit";
    }
    if (handlerName && (handlerName.includes("create") || handlerName.includes("add"))) {
      return "Add";
    }
    if (handlerName && handlerName.includes("close")) {
      return "Close";
    }
    if (handlerName && (handlerName.includes("open") || handlerName.includes("show"))) {
      return "Open";
    }
    if (handlerName && handlerName.includes("submit")) {
      return "Submit";
    }
    if (handlerName && handlerName.includes("cancel")) {
      return "Cancel";
    }
  }

  // Try to infer from surrounding context
  if (context.includes("modal") || context.includes("dialog")) {
    if (iconName === "X" || iconName === "XCircle") {
      return "Close dialog";
    }
  }

  if (context.includes("table") || context.includes("row")) {
    if (iconName === "Trash" || iconName === "Trash2") {
      return "Delete row";
    }
    if (iconName === "Edit" || iconName === "Pencil") {
      return "Edit row";
    }
  }

  // Default fallback
  return iconName ? `${iconName} action` : "Action button";
}

async function findButtonsNeedingLabels(): Promise<ButtonMatch[]> {
  const matches: ButtonMatch[] = [];

  // Find all TSX files
  const files = await glob("app/**/*.tsx", { cwd: process.cwd() });
  files.push(...(await glob("components/**/*.tsx", { cwd: process.cwd() })));

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Check for Button components without text
      const buttonRegex = /<Button[^>]*>(?!.*\w)/;
      if (buttonRegex.test(line) && !line.includes("aria-label")) {
        const buttonContent = line + (lines[i + 1] || "");
        const iconName = extractIconName(buttonContent);

        // Get context (5 lines before)
        const context = lines.slice(Math.max(0, i - 5), i).join("\n");

        // Only flag if it looks like an icon-only button
        if (
          iconName ||
          buttonContent.includes('className="h-') ||
          buttonContent.includes("size={")
        ) {
          matches.push({
            file,
            line: i + 1,
            content: buttonContent.slice(0, 100),
            iconName,
            suggestedLabel: generateLabel(buttonContent, context),
          });
        }
      }
    }
  }

  return matches;
}

async function main() {
  console.log("🔍 Scanning for buttons without ARIA labels...\n");

  const matches = await findButtonsNeedingLabels();

  if (matches.length === 0) {
    console.log("✅ All buttons have accessible labels!");
    return;
  }

  console.log(`Found ${matches.length} buttons that may need ARIA labels:\n`);

  // Group by file
  const byFile = matches.reduce(
    (acc, match) => {
      if (!acc[match.file]) {
        acc[match.file] = [];
      }
      const fileMatches = acc[match.file];
      if (fileMatches) {
        fileMatches.push(match);
      }
      return acc;
    },
    {} as Record<string, ButtonMatch[]>,
  );

  // Display grouped results
  for (const [file, fileMatches] of Object.entries(byFile)) {
    console.log(`\n📄 ${file} (${fileMatches.length} buttons)`);
    for (const match of fileMatches) {
      console.log(`  Line ${match.line}: ${match.iconName || "Unknown icon"}`);
      console.log(`  Suggested: aria-label="${match.suggestedLabel}"`);
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  Total files: ${Object.keys(byFile).length}`);
  console.log(`  Total buttons: ${matches.length}`);
  console.log(`\n💡 Next steps:`);
  console.log(`  1. Review suggestions above`);
  console.log(`  2. Manually add aria-label attributes`);
  console.log(`  3. Or use the automated fix script (coming soon)`);
}

main().catch(console.error);
