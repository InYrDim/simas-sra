#!/bin/bash
cd monorepo
script -q /dev/null -c "pnpm db:push 2>&1" | sed 's/\x1b\[[0-9;]*m//g' > /tmp/db-push-result.txt
echo "SCRIPT_DONE"
