#!/bin/sh
# Fails if PHP code passes anything but a literal string to PDO::query() / PDO::exec().
#
# Every value must reach SQL through prepare() + bound parameters. query()/exec() are only
# allowed for fixed statements like query('SELECT 1'). Run from php-module/: bin/sql-guard.sh
# CI runs it for src/ and public/ (tests may build SQL on purpose, e.g. permission checks).
set -eu

cd "$(dirname "$0")/.."

# Flags ->query( / ->exec( unless the argument is exactly one plain string literal followed by `)`.
# After the call's `(` (and optional spaces), the argument is bad if it:
#   1. starts with anything but a quote (variable, sprintf(...), empty, a line break);
#   2. is a '...' literal (\' escapes allowed) that is unterminated, or followed by anything
#      but `)` (concatenation, `. $x`, `,`), or ends the line (multi-line calls fail closed);
#   3. is a "..." literal that contains `$` (interpolation, `{$x}`), is unterminated, or is
#      followed by anything but `)`.
# `querySelector(` / `execute(` never match because `\(` must follow query/exec directly.
Q="'"
PATTERN='[-]>(query|exec)\([[:space:]]*($|[^'$Q'"[:space:]]|'$Q'([^'$Q'\\]|\\.)*('$Q'[[:space:]]*([^)[:space:]]|$)|$)|"[^"$]*("[[:space:]]*([^)[:space:]]|$)|$)|"[^"]*\$)'

# grep exits 1 for "no match" and 2 for an error (e.g. a broken pattern). Treat an error as a
# failure too, so a bad pattern can never make the guard pass silently.
status=0
grep -rnE "$PATTERN" src public || status=$?
case "$status" in
    0)
        echo "sql-guard: query()/exec() with a non-literal argument. Use prepare() with bound parameters." >&2
        exit 1
        ;;
    1) ;;
    *)
        echo "sql-guard: grep failed (status $status)." >&2
        exit 2
        ;;
esac
echo "sql-guard: ok"
