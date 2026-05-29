#!/usr/bin/env bash
# Orbit CI — Runs Vitest, Deno, and pgTAP test suites, then prints a consolidated summary.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CI_TMP=$(mktemp -d)
trap 'rm -rf "$CI_TMP"' EXIT

VITEST_LOG="$CI_TMP/vitest.log"
DENO_LOG="$CI_TMP/deno.log"
PGTAP_LOG="$CI_TMP/pgtap.log"

VITEST_EXIT=0
DENO_EXIT=0
PGTAP_EXIT=0
TYPES_EXIT=0

COV_THRESHOLD=80

strip_ansi() {
  sed 's/\x1b\[[0-9;]*[mGKH]//g' "$1"
}

below_threshold() {
  awk -v val="$1" -v thr="$COV_THRESHOLD" 'BEGIN { exit !(val+0 < thr+0) }'
}

cov_color() {
  local val="$1"
  if below_threshold "$val"; then
    echo -e "${RED}${BOLD}${val}%${NC}"
  else
    echo -e "${GREEN}${BOLD}${val}%${NC}"
  fi
}

section() {
  local color="$1" num="$2" title="$3"
  echo ""
  echo -e "${color}──────────────────────────────────────────────────────────────${NC}"
  echo -e "${BOLD} [$num] $title${NC}"
  echo -e "${color}──────────────────────────────────────────────────────────────${NC}"
  echo ""
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                  Orbit CI — Test Runner                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"

# ── 1. Vitest (Frontend Unit Tests) ──────────────────────────

section "$BLUE" "1/4" "Vitest — Frontend Unit Tests"

vitest run --coverage 2>&1 | tee "$VITEST_LOG"
VITEST_EXIT=${PIPESTATUS[0]}

# ── 2. Deno (Edge Function Tests) ────────────────────────────

section "$CYAN" "2/4" "Deno — Supabase Edge Function Tests"

DENO_COV_DIR="$CI_TMP/deno-cov"
deno test --config supabase/functions/deno.json supabase/functions/ -A --no-check \
  --coverage="$DENO_COV_DIR" 2>&1 | tee "$DENO_LOG"
DENO_EXIT=${PIPESTATUS[0]}

# ── 3. pgTAP (Database Tests) ────────────────────────────────

section "$YELLOW" "3/4" "pgTAP — Database Tests"

npx supabase test db 2>&1 | tee "$PGTAP_LOG"
PGTAP_EXIT=${PIPESTATUS[0]}

# ── 4. Supabase types drift check ─────────────────────────────

section "$GREEN" "4/4" "Supabase Types — Schema Drift Check"

TYPES_LOG="$CI_TMP/types.log"
yarn check-supabase-types 2>&1 | tee "$TYPES_LOG"
TYPES_EXIT=${PIPESTATUS[0]}

# ── Parse results ────────────────────────────────────────────

vitest_clean=$(strip_ansi "$VITEST_LOG")

vitest_tests_line=$(echo "$vitest_clean" | grep -P '^\s*Tests\s+' | tail -1 || true)
vitest_passed=$(echo "$vitest_tests_line" | grep -oP '\d+(?=\s+passed)' || echo "0")
vitest_failed=$(echo "$vitest_tests_line" | grep -oP '\d+(?=\s+failed)' || echo "0")
vitest_total=$((vitest_passed + vitest_failed))

# Vitest coverage — try text-summary format first, then table "All files" row
# text-summary: "Statements   : 80.00% ( 100/125 )"
vitest_stmts=$(echo "$vitest_clean" | grep -oP 'Statements\s*:\s*\K[\d.]+(?=\s*%)' || true)
vitest_branches=$(echo "$vitest_clean" | grep -oP 'Branches\s*:\s*\K[\d.]+(?=\s*%)' || true)
vitest_functions=$(echo "$vitest_clean" | grep -oP 'Functions\s*:\s*\K[\d.]+(?=\s*%)' || true)
vitest_lines_cov=$(echo "$vitest_clean" | grep -oP 'Lines\s*:\s*\K[\d.]+(?=\s*%)' || true)

# Fallback: table format — "| All files | XX.XX | YY.YY | ZZ.ZZ | WW.WW |"
if [ -z "$vitest_stmts" ]; then
  vitest_all_files=$(echo "$vitest_clean" | grep 'All files' | head -1 || true)
  if [ -n "$vitest_all_files" ]; then
    vitest_stmts=$(echo "$vitest_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $3); print $3 }')
    vitest_branches=$(echo "$vitest_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $4); print $4 }')
    vitest_functions=$(echo "$vitest_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $5); print $5 }')
    vitest_lines_cov=$(echo "$vitest_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $6); print $6 }')
  fi
fi

deno_clean=$(strip_ansi "$DENO_LOG")

deno_summary=$(echo "$deno_clean" | grep -P '(ok|FAILED)\s*\|' | tail -1 || true)
deno_passed=$(echo "$deno_summary" | grep -oP '\d+(?=\s+passed)' || echo "0")
deno_failed=$(echo "$deno_summary" | grep -oP '\d+(?=\s+failed)' || echo "0")
deno_total=$((deno_passed + deno_failed))

# Deno coverage — table format: "| All files | Branch % | Function % | Line % |"
deno_all_files=$(echo "$deno_clean" | grep 'All files' | head -1 || true)
deno_branch=""
deno_funcs=""
deno_lines_cov=""
if [ -n "$deno_all_files" ]; then
  deno_branch=$(echo "$deno_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $3); print $3 }')
  deno_funcs=$(echo "$deno_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $4); print $4 }')
  deno_lines_cov=$(echo "$deno_all_files" | awk -F'|' '{ gsub(/[^0-9.]/, "", $5); print $5 }')
fi

pgtap_clean=$(strip_ansi "$PGTAP_LOG")

pgtap_stats=$(echo "$pgtap_clean" | grep -oP 'Files=\d+, Tests=\d+' | tail -1 || true)
pgtap_files=$(echo "$pgtap_stats" | grep -oP '(?<=Files=)\d+' || echo "0")
pgtap_total=$(echo "$pgtap_stats" | grep -oP '(?<=Tests=)\d+' || echo "0")
pgtap_failed=$(echo "$pgtap_clean" | grep -oP '\d+(?=/\d+ subtests failed)' || echo "0")
pgtap_passed=$((pgtap_total - pgtap_failed))

# ── Summary ──────────────────────────────────────────────────

echo ""
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}                       CI Summary                           ${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo ""

print_result() {
  local name="$1" exit_code="$2" passed="$3" failed="$4" total="$5"
  if [ "$exit_code" -eq 0 ]; then
    echo -e "  ${BOLD}$name${NC}  ${GREEN}PASS${NC}"
  else
    echo -e "  ${BOLD}$name${NC}  ${RED}FAIL${NC}"
  fi
  echo -e "    Tests: ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}, $total total"
}

VITEST_COV_FAIL=0
DENO_COV_FAIL=0

print_result "Vitest (Frontend)" "$VITEST_EXIT" "$vitest_passed" "$vitest_failed" "$vitest_total"
if [ -n "$vitest_stmts" ]; then
  echo -e "    Coverage: Stmts $(cov_color "$vitest_stmts") | Branch $(cov_color "$vitest_branches") | Funcs $(cov_color "$vitest_functions") | Lines $(cov_color "$vitest_lines_cov")"
  for v in "$vitest_stmts" "$vitest_branches" "$vitest_functions" "$vitest_lines_cov"; do
    below_threshold "$v" && VITEST_COV_FAIL=1
  done
  if [ "$VITEST_COV_FAIL" -eq 1 ]; then
    echo -e "    ${RED}Coverage below ${COV_THRESHOLD}% threshold${NC}"
  fi
fi
echo ""

print_result "Deno (Edge Functions)" "$DENO_EXIT" "$deno_passed" "$deno_failed" "$deno_total"
if [ -n "$deno_lines_cov" ]; then
  echo -e "    Coverage: Branch $(cov_color "$deno_branch") | Funcs $(cov_color "$deno_funcs") | Lines $(cov_color "$deno_lines_cov")"
  for v in "$deno_branch" "$deno_funcs" "$deno_lines_cov"; do
    below_threshold "$v" && DENO_COV_FAIL=1
  done
  if [ "$DENO_COV_FAIL" -eq 1 ]; then
    echo -e "    ${RED}Coverage below ${COV_THRESHOLD}% threshold${NC}"
  fi
fi
echo ""

print_result "pgTAP (Database)" "$PGTAP_EXIT" "$pgtap_passed" "$pgtap_failed" "$pgtap_total"
echo -e "    ${DIM}$pgtap_files test files (no coverage available for pgTAP)${NC}"
echo ""

if [ "$TYPES_EXIT" -eq 0 ]; then
  echo -e "  ${BOLD}Supabase Types${NC}  ${GREEN}PASS${NC}"
  echo -e "    ${DIM}database.types.ts matches local schema${NC}"
else
  echo -e "  ${BOLD}Supabase Types${NC}  ${RED}FAIL${NC}"
  echo -e "    ${RED}Run yarn generate-supabase-types and commit${NC}"
fi
echo ""

# ── Overall ──────────────────────────────────────────────────

OVERALL=0
[ "$VITEST_EXIT"    -ne 0 ] && OVERALL=1
[ "$DENO_EXIT"      -ne 0 ] && OVERALL=1
[ "$PGTAP_EXIT"     -ne 0 ] && OVERALL=1
[ "$TYPES_EXIT"     -ne 0 ] && OVERALL=1
[ "$VITEST_COV_FAIL" -eq 1 ] && OVERALL=1
[ "$DENO_COV_FAIL"   -eq 1 ] && OVERALL=1

TOTAL_PASSED=$((vitest_passed + deno_passed + pgtap_passed))
TOTAL_FAILED=$((vitest_failed + deno_failed + pgtap_failed))
TOTAL_ALL=$((vitest_total + deno_total + pgtap_total))

echo -e "${BOLD}──────────────────────────────────────────────────────────────${NC}"
if [ "$OVERALL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL SUITES PASSED${NC}  ${DIM}($TOTAL_PASSED/$TOTAL_ALL tests across 3 suites + types check)${NC}"
else
  echo -e "  ${RED}${BOLD}SOME SUITES FAILED${NC}  ${DIM}($TOTAL_PASSED passed, $TOTAL_FAILED failed, $TOTAL_ALL total)${NC}"
fi
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo ""

exit $OVERALL
