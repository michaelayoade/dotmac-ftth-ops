#!/bin/bash
set -e

echo "Fixing GraphQL hooks TS2375 errors..."

# useSubscriptionsGraphQL.ts - Fix all variables with undefined values
FILE="hooks/useSubscriptionsGraphQL.ts"

# Line 57 fix
sed -i '' '57s/status: status || undefined/...(status \&\& { status })/' "$FILE"
sed -i '' '57s/billingCycle: billingCycle || undefined/...(billingCycle \&\& { billingCycle })/' "$FILE"
sed -i '' '57s/search: search || undefined/...(search \&\& { search })/' "$FILE"

# Line 185 fix  
sed -i '' '185s/isActive: isActive !== undefined ? isActive : undefined/...(isActive !== undefined \&\& { isActive })/' "$FILE"
sed -i '' '185s/billingCycle: billingCycle || undefined/...(billingCycle \&\& { billingCycle })/' "$FILE"

# Line 225 fix
sed -i '' '225s/isActive: isActive !== undefined ? isActive : undefined/...(isActive !== undefined \&\& { isActive })/' "$FILE"
sed -i '' '225s/category: category || undefined/...(category \&\& { category })/' "$FILE"

# Line 266 fix
sed -i '' '266s/status: status || undefined/...(status \&\& { status })/' "$FILE"
sed -i '' '266s/search: search || undefined/...(search \&\& { search })/' "$FILE"

echo "Fixed useSubscriptionsGraphQL.ts"

# useUsersGraphQL.ts fixes
FILE="hooks/useUsersGraphQL.ts"

# These require reading the file to fix properly - the sed patterns are complex
echo "Skipping useUsersGraphQL.ts - requires manual fix"

# useWirelessGraphQL.ts fixes
FILE="hooks/useWirelessGraphQL.ts"
echo "Skipping useWirelessGraphQL.ts - requires manual fix"

echo "GraphQL hooks partially fixed. Manual fixes needed for complex cases."
