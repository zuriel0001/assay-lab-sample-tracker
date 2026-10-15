#!/bin/sh
# Runs every browser suite one at a time and prints one line per suite. Usage: sh run-all.sh [suite ...]
cd "$(dirname "$0")"
S=${*:-"v18-tests v17-tests v16-tests v15-tests v14-tests hours-shortcut-tests run results-tests v12-tests v13-tests review-tests-v11 review-v11-scenarios"}
for s in $S; do
  [ -f $s.js ] || continue
  NODE_PATH=$(npm root -g) timeout 590 node $s.js > out-$s.txt 2>&1; ec=$?
  echo "== $s PASS=$(grep -c '^\s*PASS' out-$s.txt) FAIL=$(grep -c '^\s*FAIL' out-$s.txt) OK=$(grep -c '^\s*OK' out-$s.txt) BUG=$(grep -c '^\s*BUG' out-$s.txt) EXIT=$ec"
  grep -E '^\s*(FAIL|BUG)|Console errors: \[|Error' out-$s.txt | head -8
done
node work-hours-unit.js | grep -cE '^\s*PASS' | sed 's/^/== work-hours-unit PASS=/'
