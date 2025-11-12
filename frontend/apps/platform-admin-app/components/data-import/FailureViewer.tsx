"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { Button } from "@dotmac/ui";
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDataImport } from "@/hooks/useDataImport";

interface FailureViewerProps {
  jobId: string;
}

export function FailureViewer({ jobId }: FailureViewerProps) {
  const { useImportFailures } = useDataImport();
  const { data: failures, isLoading } = useImportFailures(jobId);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!failures || failures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No failures to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-20">Row</TableHead>
              <TableHead>Error Type</TableHead>
              <TableHead>Error Message</TableHead>
              <TableHead className="w-32">Fields with Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.map((failure) => {
              const isExpanded = expandedRows.has(failure.row_number);
              const fieldErrorCount = Object.keys(failure.field_errors || {}).length;

              return (
                <CollapsiblePrimitive.Root
                  key={failure.row_number}
                  open={isExpanded}
                  onOpenChange={() => toggleRow(failure.row_number)}
                  asChild
                >
                  <>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell>
                        <CollapsiblePrimitive.Trigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsiblePrimitive.Trigger>
                      </TableCell>

                      <TableCell className="font-mono text-sm">
                        {failure.row_number}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{failure.error_type}</Badge>
                      </TableCell>

                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{failure.error_message}</p>
                      </TableCell>

                      <TableCell>
                        {fieldErrorCount > 0 && (
                          <Badge variant="secondary">{fieldErrorCount} field{fieldErrorCount !== 1 ? 's' : ''}</Badge>
                        )}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <CollapsiblePrimitive.Content>
                          <div className="p-4 bg-muted/30 space-y-4">
                            {/* Field-level errors */}
                            {fieldErrorCount > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Field Errors:</h4>
                                <div className="space-y-1">
                                  {Object.entries(failure.field_errors).map(([field, error]) => (
                                    <div key={field} className="flex items-start gap-2 text-sm">
                                      <Badge variant="outline" className="mt-0.5">
                                        {field}
                                      </Badge>
                                      <span className="text-destructive">{error}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Original row data */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Original Row Data:</h4>
                              <div className="rounded-md bg-background p-3 border">
                                <pre className="text-xs font-mono overflow-x-auto">
                                  {JSON.stringify(failure.row_data, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Full error message */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Full Error Message:</h4>
                              <p className="text-sm text-destructive p-3 rounded-md bg-destructive/10">
                                {failure.error_message}
                              </p>
                            </div>
                          </div>
                        </CollapsiblePrimitive.Content>
                      </TableCell>
                    </TableRow>
                  </>
                </CollapsiblePrimitive.Root>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {failures.length} failed record{failures.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
