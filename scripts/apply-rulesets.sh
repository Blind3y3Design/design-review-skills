#!/usr/bin/env bash
#
# Apply the branch rulesets in .github/rulesets/ to this repository.
#
# Create-or-update by ruleset name: a ruleset whose name already exists is
# updated (PUT /repos/:owner/:repo/rulesets/:id); one that does not is created
# (POST /repos/:owner/:repo/rulesets). This script never deletes anything, and
# rulesets other than the two managed here are left untouched.
#
# Usage:
#   scripts/apply-rulesets.sh [--dry-run]
#
# Environment:
#   GITHUB_REPOSITORY   owner/repo. Derived from the origin remote if unset.
#   RELEASE_APP_ID      GitHub App ID (not the installation ID) of the release
#                       App named on main's bypass list. Required to apply
#                       main.json; only needed for --dry-run if you want the
#                       printed payload to show a real ID instead of the
#                       __RELEASE_APP_ID__ placeholder.

set -euo pipefail

PLACEHOLDER='"__RELEASE_APP_ID__"'
PLACEHOLDER_TOKEN="__RELEASE_APP_ID__"
dry_run=0

usage() {
  sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() {
  printf 'apply-rulesets: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'apply-rulesets: %s\n' "$*" >&2
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf 'apply-rulesets: unknown argument: %s\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v gh >/dev/null 2>&1 || die "gh CLI is required"
command -v node >/dev/null 2>&1 || die "node is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd "$script_dir/.." && pwd)
rules_dir="$repo_root/.github/rulesets"
rules_files="$rules_dir/main.json $rules_dir/integration.json"

# --- Repository slug -------------------------------------------------------

repo="${GITHUB_REPOSITORY:-}"
if [ -z "$repo" ]; then
  remote_url=$(git -C "$repo_root" remote get-url origin 2>/dev/null) ||
    die "no origin remote; set GITHUB_REPOSITORY=owner/repo"
  case "$remote_url" in
    git@*:*)
      repo=${remote_url#git@}
      repo=${repo#*:}
      ;;
    https://* | http://* | ssh://*)
      repo=${remote_url#*://}
      repo=${repo#*@}
      repo=${repo#*/}
      ;;
    *)
      die "cannot derive owner/repo from origin URL: $remote_url"
      ;;
  esac
  repo=${repo%.git}
fi

case "$repo" in
  */*/* | */*/*/*) die "expected owner/repo, got: $repo" ;;
  */*) ;;
  *) die "expected owner/repo, got: $repo" ;;
esac

# --- Helpers ---------------------------------------------------------------

# Read the ruleset name out of a ruleset JSON body.
ruleset_name() {
  node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!b.name)process.exit(1);process.stdout.write(b.name)' "$1"
}

# Fail if the payload is not valid JSON.
assert_json() {
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$1" ||
    die "payload for $2 is not valid JSON"
}

# Ids of existing rulesets with the given name (may be empty).
existing_ids() {
  gh api --paginate "repos/$repo/rulesets?per_page=100" \
    --jq ".[] | select(.name == \"$1\") | .id"
}

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

# --- Per ruleset -----------------------------------------------------------

for file in $rules_files; do
  [ -f "$file" ] || die "missing ruleset file: $file"

  name=$(ruleset_name "$file") || die "cannot read name from $file"
  payload=$(cat "$file")

  case "$payload" in
    *"$PLACEHOLDER"*)
      if [ -n "${RELEASE_APP_ID:-}" ]; then
        case "$RELEASE_APP_ID" in
          *[!0-9]*) die "RELEASE_APP_ID must be a numeric GitHub App ID, got: $RELEASE_APP_ID" ;;
        esac
        payload=${payload//"$PLACEHOLDER"/$RELEASE_APP_ID}
      elif [ "$dry_run" -eq 1 ]; then
        warn "RELEASE_APP_ID not set; the $name payload below still contains $PLACEHOLDER_TOKEN"
      else
        die "RELEASE_APP_ID must be set to the release GitHub App ID before applying $name"
      fi
      ;;
  esac

  printf '%s' "$payload" >"$tmp_dir/payload.json"
  assert_json "$tmp_dir/payload.json" "$name"

  existing_id=$(existing_ids "$name" | sed -n '1p')

  if [ "$dry_run" -eq 1 ]; then
    if [ -n "$existing_id" ]; then
      printf 'dry-run: would update ruleset %s (%s) via PUT repos/%s/rulesets/%s\n' \
        "$name" "$existing_id" "$repo" "$existing_id"
    else
      printf 'dry-run: would create ruleset %s via POST repos/%s/rulesets\n' \
        "$name" "$repo"
    fi
    printf 'payload:\n'
    node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")),null,2)+"\n")' "$tmp_dir/payload.json"
    continue
  fi

  if [ -n "$existing_id" ]; then
    gh api --method PUT "repos/$repo/rulesets/$existing_id" \
      --input "$tmp_dir/payload.json" >/dev/null
    printf 'updated ruleset %s (id %s)\n' "$name" "$existing_id"
  else
    gh api --method POST "repos/$repo/rulesets" \
      --input "$tmp_dir/payload.json" >/dev/null
    printf 'created ruleset %s\n' "$name"
  fi
done
