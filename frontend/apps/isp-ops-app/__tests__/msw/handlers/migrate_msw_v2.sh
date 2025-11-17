#!/bin/bash

for file in apiKeys.ts audit.ts billing-plans.ts commission-rules.ts credit-notes.ts dunning.ts faults.ts featureFlags.ts field-service.ts invoice-actions.ts jobs.ts network-monitoring.ts notifications.ts partners.ts reconciliation.ts scheduler.ts service-lifecycle.ts subscribers.ts technicians.ts users.ts webhooks.ts; do
  echo "Migrating $file to MSW v2..."
  
  # 1. Change imports from 'msw' to use http and HttpResponse
  sed -i '' "s/import { rest } from 'msw';/import { http, HttpResponse } from 'msw';/g" "$file"
  sed -i '' 's/import { rest } from "msw";/import { http, HttpResponse } from "msw";/g' "$file"
  
  # 2. Change rest.get/post/patch/delete to http.get/post/patch/delete
  sed -i '' 's/rest\.get(/http.get(/g' "$file"
  sed -i '' 's/rest\.post(/http.post(/g' "$file"
  sed -i '' 's/rest\.patch(/http.patch(/g' "$file"
  sed -i '' 's/rest\.delete(/http.delete(/g' "$file"
  sed -i '' 's/rest\.put(/http.put(/g' "$file"
  
  # 3. Change function signatures
  sed -i '' 's/(req, res, ctx) =>/({{ request, params }} => /g' "$file"
  sed -i '' 's/async (req, res, ctx) =>/async ({ request, params }) =>/g' "$file"
  
  # 4. Change req.url to request.url
  sed -i '' 's/req\.url/request.url/g' "$file"
  
  # 5. Change req.params to params
  sed -i '' 's/req\.params/params/g' "$file"
  
  # 6. Change req.json() to request.json()
  sed -i '' 's/await req\.json/await request.json/g' "$file"
  sed -i '' 's/req\.json()/request.json()/g' "$file"
  
  # 7. Change res(ctx.json(...)) to HttpResponse.json(...)
  sed -i '' 's/return res(ctx\.json(\([^)]*\)))/return HttpResponse.json(\1)/g' "$file"
  
  # 8. Change res(ctx.status(XXX), ctx.json(...)) to HttpResponse.json(..., { status: XXX })
  sed -i '' 's/return res(ctx\.status(\([0-9]*\)), ctx\.json(\([^)]*\)))/return HttpResponse.json(\2, { status: \1 })/g' "$file"
  
  # 9. Change res(ctx.status(XXX)) to new HttpResponse(null, { status: XXX })
  sed -i '' 's/return res(ctx\.status(\([0-9]*\)))/return new HttpResponse(null, { status: \1 })/g' "$file"
  
done

echo "Migration complete!"
