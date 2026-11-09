/**
 * Minimal glob matcher with no dependencies.
 *
 * Supports `**`, `*`, `?` and `{a,b}`. A pattern with no `/` matches the file's
 * basename anywhere in the tree (like .gitignore), so `Dockerfile` matches
 * `services/api/Dockerfile`.
 */
const cache = new Map<string, RegExp>();

export function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  let re = "";
  let i = 0;
  let braceDepth = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
      continue;
    }
    if (c === "?") re += "[^/]";
    else if (c === "{") {
      re += "(?:";
      braceDepth++;
    } else if (c === "}" && braceDepth > 0) {
      re += ")";
      braceDepth--;
    } else if (c === "," && braceDepth > 0) re += "|";
    else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
    i += 1;
  }

  const compiled = new RegExp(`^${re}$`, "i");
  cache.set(pattern, compiled);
  return compiled;
}

export function matchesGlob(path: string, pattern: string): boolean {
  const normalized = path.replace(/^\.\//, "");
  if (!pattern.includes("/")) {
    const base = normalized.slice(normalized.lastIndexOf("/") + 1);
    return globToRegExp(pattern).test(base);
  }
  return globToRegExp(pattern).test(normalized);
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesGlob(path, p));
}
