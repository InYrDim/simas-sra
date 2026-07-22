#!/bin/sh
cd monorepo
nohup sh -c 'npx drizzle-kit push 2>&1 > /tmp/dbpush-final.txt; echo "EXIT=$?" >> /tmp/dbpush-final.txt' &
echo "LAUNCHED_PID=$!"
