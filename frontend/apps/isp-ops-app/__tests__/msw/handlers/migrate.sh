#!/bin/bash

for file in apiKeys.ts audit.ts billing-plans.ts commission-rules.ts credit-notes.ts dunning.ts faults.ts featureFlags.ts field-service.ts invoice-actions.ts jobs.ts network-monitoring.ts notifications.ts partners.ts reconciliation.ts scheduler.ts service-lifecycle.ts subscribers.ts technicians.ts users.ts webhooks.ts; do
  echo "Migrating $file..."
  
  # Read the file and process it with awk
  awk '
  {
    line = $0
    
    # Check if line contains (req, res, ctx) or async (req, res, ctx)
    if (line ~ /\(req, res, ctx\) =>/) {
      # Check if the handler uses req.url, req.params, or await req.json
      uses_request_url = 0
      uses_params = 0
      uses_request_json = 0
      
      # Store the current line
      handler_line = line
      
      # Print the line but we will fix it later after reading ahead
      # For now, just do a simple replacement based on what we find
      
      # Replace patterns:
      # 1. If it is just closing function, use ()
      # 2. Otherwise use ({ request, params })
      
      # Simple approach: always use ({ request, params }) and let unused vars be
      gsub(/\(req, res, ctx\) =>/, "({ request, params }) =>", line)
      gsub(/async \(req, res, ctx\) =>/, "async ({ request, params }) =>", line)
    }
    
    # Replace req.url with request.url
    gsub(/req\.url/, "request.url", line)
    
    # Replace req.params with params  
    gsub(/req\.params/, "params", line)
    
    # Replace await req.json with await request.json
    gsub(/await req\.json/, "await request.json", line)
    
    # Replace req.json() with request.json()
    gsub(/req\.json\(\)/, "request.json()", line)
    
    print line
  }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
done

echo "Migration complete!"
