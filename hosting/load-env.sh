# Sourced by run.sh and build-notes.sh. Reads KEY=VALUE lines from .env literally
# (no shell expansion), so values like bcrypt hashes containing "$" are safe.
load_env() {
  local file="$1" line key val
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    [ "$key" = "$line" ] && continue
    val="${val%%[[:space:]]#*}"                  # drop trailing "  # comment"
    val="${val%"${val##*[![:space:]]}"}"         # trim trailing spaces
    case "$val" in \"*\") val="${val#\"}"; val="${val%\"}" ;; \'*\') val="${val#\'}"; val="${val%\'}" ;; esac
    export "$key=$val"
  done < "$file"
}
