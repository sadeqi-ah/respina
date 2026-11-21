#!/bin/sh
# Checks the SQL guard's pattern against tests/sql-guard-cases.txt.
set -eu
cd "$(dirname "$0")/.."
# Load Q and PATTERN exactly as the guard defines them (the pattern is built with shell quoting).
eval "$(sed -n '/^Q=/p;/^PATTERN=/p' bin/sql-guard.sh)"
fail=0
while IFS= read -r line; do
    case "$line" in
        "BAD: "*) code=${line#BAD: }; printf '%s\n' "$code" | grep -qE "$PATTERN" || { echo "MISSED:  $code"; fail=1; } ;;
        "OK: "*)  code=${line#OK: };  printf '%s\n' "$code" | grep -qE "$PATTERN" && { echo "FALSE+:  $code"; fail=1; } ;;
    esac
done < tests/sql-guard-cases.txt
[ "$fail" -eq 0 ] && echo "sql-guard-test: all cases pass"
exit "$fail"
