#!/usr/bin/env bash
#
# Pre-commit hook for security audit and correctness checks
# Runs: secret detection, dependency audit, tech debt scan, typecheck, lint, unit tests
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARNINGS=0

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_pass() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

run_check() {
  local name="$1"
  local cmd="$2"
  local optional="${3:-false}"

  echo ""
  log_info "Running: $name..."

  if eval "$cmd" 2>&1; then
    log_pass "$name passed"
    PASS=$((PASS + 1))
    return 0
  else
    if [ "$optional" = "true" ]; then
      log_warn "$name failed (optional)"
      WARNINGS=$((WARNINGS + 1))
      return 0
    else
      log_fail "$name failed"
      FAIL=$((FAIL + 1))
      return 1
    fi
  fi
}

check_secrets() {
  log_info "Scanning for potential secrets/credentials..."

  local found_secrets=0

  # Search for API keys in code
  local matches
  matches=$(git grep -E "api[_-]?key.*=.*[\"'][a-zA-Z0-9_-]{16,}" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "node_modules\|dist/" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential API keys found:"
    echo "$matches" | head -5
    found_secrets=1
  fi

  # Search for private keys
  matches=$(git grep -l "BEGIN.*PRIVATE KEY" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.pem" 2>/dev/null | grep -v "node_modules\|dist/" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential private keys found in:"
    echo "$matches"
    found_secrets=1
  fi

  # Search for hardcoded passwords
  matches=$(git grep -E "password.*=.*[\"'][^\"']{8,}[\"']" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "node_modules\|dist/\|test\|spec" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential hardcoded passwords found:"
    echo "$matches" | head -5
    found_secrets=1
  fi

  # Search for tokens
  matches=$(git grep -E "token.*=.*[\"'][a-zA-Z0-9_-]{20,}" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "node_modules\|dist/" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential tokens found:"
    echo "$matches" | head -5
    found_secrets=1
  fi

  # AWS Access Key IDs
  matches=$(git grep -E "AKIA[0-9A-Z]{16}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" 2>/dev/null | grep -v "node_modules\|dist/" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential AWS Access Keys found:"
    echo "$matches" | head -5
    found_secrets=1
  fi

  # GitHub tokens
  matches=$(git grep -E "gh[pousr]_[A-Za-z0-9_]{36,}" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "node_modules\|dist/" || true)
  if [ -n "$matches" ]; then
    log_warn "Potential GitHub tokens found:"
    echo "$matches" | head -5
    found_secrets=1
  fi

  # Check for .env files that shouldn't be committed
  local env_files
  env_files=$(git ls-files 2>/dev/null | grep -E '^\.env\.(local|production|prod)$' || true)
  if [ -n "$env_files" ]; then
    log_warn "Environment files that should not be committed:"
    echo "$env_files"
    found_secrets=1
  fi

  if [ "$found_secrets" -eq 1 ]; then
    echo ""
    log_fail "Potential secrets detected! Review findings above."
    return 1
  fi

  log_pass "No obvious secrets detected"
  return 0
}

check_dependency_audit() {
  log_info "Running npm audit (runtime deps only)..."

  local audit_file
  audit_file="/tmp/audit-$$.json"

  # Check production/runtime dependencies by default so pre-commit isn't blocked
  # by known dev-only vulnerabilities from tooling packages.
  npm audit --omit=dev --json > "$audit_file" 2>/dev/null || true

  if [ -f "$audit_file" ]; then
    local critical_count
    local high_count
    critical_count=$(grep -c '"severity": "critical"' "$audit_file" 2>/dev/null || true)
    high_count=$(grep -c '"severity": "high"' "$audit_file" 2>/dev/null || true)
    critical_count=${critical_count:-0}
    high_count=${high_count:-0}
    rm -f "$audit_file"

    if [ "$critical_count" -gt 0 ] || [ "$high_count" -gt 0 ]; then
      log_fail "Found $critical_count critical and $high_count high severity vulnerabilities"
      npm audit --omit=dev --audit-level=high 2>&1 | tail -20
      return 1
    fi
  fi

  log_pass "No critical/high vulnerabilities found"
  return 0
}

check_typescript() {
  log_info "Running TypeScript type check..."
  npm run typecheck 2>&1 | tail -30
  return "${PIPESTATUS[0]}"
}

check_lint() {
  log_info "Running Biome lint check (staged source files)..."

  local staged_files=()
  while IFS= read -r file; do
    [ -n "$file" ] && staged_files+=("$file")
  done < <(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx|css|html)$' || true)

  if [ "${#staged_files[@]}" -eq 0 ]; then
    log_info "No staged source files to lint"
    return 0
  fi

  npx biome check --diagnostic-level=error "${staged_files[@]}" 2>&1 | tail -40
  return "${PIPESTATUS[0]}"
}

check_unit_tests() {
  log_info "Running unit tests..."
  npm run test:unit 2>&1 | tail -40
  return "${PIPESTATUS[0]}"
}

check_tech_debt() {
  log_info "Scanning staged files for tech debt markers..."
  local staged_files
  staged_files=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep -E '\.(ts|tsx|js|jsx|css|html)$' || true)
  if [ -z "$staged_files" ]; then
    log_info "No staged source files to scan"
    return 0
  fi
  npm run check:tech-debt 2>&1 | tail -20
  return "${PIPESTATUS[0]}"
}

bump_version() {
  if [ "${DISABLE_VERSION_BUMP:-0}" = "1" ]; then
    log_info "Version bump disabled via DISABLE_VERSION_BUMP=1"
    return 0
  fi

  log_info "Incrementing version..."
  node scripts/bump-version.mjs 2>&1
  local new_version
  new_version=$(node -p "require('./package.json').version" 2>/dev/null)
  log_info "Version bumped to $new_version"
  # Stage the version changes
  git add package.json packages/extension/manifest.json packages/extension/manifest.firefox.json 2>/dev/null || true
  return 0
}

# Main
echo "═══════════════════════════════════════════════════════════"
echo "  Pre-commit Security & Correctness Audit"
echo "═══════════════════════════════════════════════════════════"

start_time=$(date +%s)

run_check "Secret/Credential Detection" "check_secrets"
run_check "Dependency Audit" "check_dependency_audit"
run_check "Tech Debt Scan" "check_tech_debt"
run_check "TypeScript Type Check" "check_typescript"
run_check "Lint Check" "check_lint"
run_check "Unit Tests" "check_unit_tests"

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Summary"
echo "═══════════════════════════════════════════════════════════"
printf "Passed:  ${GREEN}%d${NC}\n" "$PASS"
printf "Failed:  ${RED}%d${NC}\n" "$FAIL"
printf "Warnings: ${YELLOW}%d${NC}\n" "$WARNINGS"
printf "Duration: %ds\n" "$duration"
echo "═══════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  log_fail "Pre-commit checks failed. Fix issues before committing."
  log_info "To bypass: git commit --no-verify"
  exit 1
fi

# All checks passed - bump version
run_check "Version Bump" "bump_version" "true"

log_pass "All checks passed! Proceeding with commit."
exit 0
