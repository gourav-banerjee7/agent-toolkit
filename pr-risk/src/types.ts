export type FileStatus = "added" | "modified" | "removed" | "renamed";

/** One file in a pull request, in the same shape the GitHub API and `git diff` can both produce. */
export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  /** Unified diff hunks for this file. Missing for binary or very large files. */
  patch?: string;
}

export type RiskLevel = "critical" | "significant" | "routine";

export interface Category {
  id: string;
  label: string;
  points: number;
  patterns: string[];
  /** Paths that match `patterns` but should not count, e.g. `.env.example`. */
  exclude?: string[];
}

export interface Config {
  thresholds: { critical: number; significant: number };
  categories: Category[];
  testPatterns: string[];
  docPatterns: string[];
  size: {
    largeLines: number;
    largePoints: number;
    hugeLines: number;
    hugePoints: number;
    manyFiles: number;
    manyFilesPoints: number;
  };
  /** Changed non-test code lines above which a PR with no test changes gets flagged. */
  untestedLines: number;
}

export interface Signal {
  id: string;
  label: string;
  points: number;
  detail: string;
  files: string[];
  /** A signal that forces the PR to critical regardless of score (e.g. a leaked secret). */
  forcesCritical?: boolean;
}

export interface Report {
  level: RiskLevel;
  score: number;
  signals: Signal[];
  stats: {
    files: number;
    additions: number;
    deletions: number;
    testFiles: number;
  };
  /** Rough reviewer time in minutes, from diff size and risk. */
  reviewMinutes: number;
}
