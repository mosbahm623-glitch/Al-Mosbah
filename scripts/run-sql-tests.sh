#!/usr/bin/env bash
# Builds the database from supabase/migrations on a plain Postgres and runs the SQL tests in supabase/tests.
# Usage: PGURL=postgres://postgres:postgres@localhost:5432/postgres scripts/run-sql-tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PGURL:?set PGURL to a throwaway database}"
psql() { command psql "$PGURL" -v ON_ERROR_STOP=1 -q "$@"; }
psql -f supabase/tests/ci/bootstrap.sql
for f in supabase/migrations/*.sql; do
  # pg_net does not exist on a plain Postgres: bootstrap.sql provides a stand-in
  sed '/create extension if not exists pg_net/d' "$f" | psql -f - >/dev/null || { echo "migration failed: $f"; exit 1; }
done
psql -f supabase/tests/ci/seed.sql
[ -z "${EXTRA_SQL:-}" ] || psql -c "$EXTRA_SQL" # used only to prove the tests fail when protection is removed
fail=0
TESTS="counted_entries reset_data rls_advances rls_users rls_and_totals installment_approval low_balance_alert owner_banks project_shares"
for t in $TESTS; do
  f="supabase/tests/$t.sql"
  echo "== $f"
  out=$(command psql "$PGURL" -q -At -F '|' -f "$f" 2>&1 || true)
  # the two styles: a "RESULTS" error with one "name ok|FAIL" line per check, or a table of name|got|expected[|ok]
  if grep -q 'RESULTS' <<<"$out"; then
    grep -E ' (ok|FAIL)' <<<"$out" | grep -v '^psql:'
    grep -q ' FAIL' <<<"$out" && fail=1
    continue
  fi
  rows=$(grep -E '^[a-z_0-9]+\|' <<<"$out" || true)
  if [ -z "$rows" ]; then echo "$out"; echo "no results from $f"; fail=1; continue; fi
  while IFS='|' read -r k got expected res; do
    verdict=ok
    if [ -n "${res:-}" ]; then [[ "$res" == ok || "$res" == t ]] || verdict=FAIL
    else [ "$got" == "$expected" ] || verdict=FAIL; fi
    echo "$k $verdict"
    [ "$verdict" == ok ] || { echo "   got=$got expected=$expected"; fail=1; }
  done <<<"$rows"
done
exit $fail
