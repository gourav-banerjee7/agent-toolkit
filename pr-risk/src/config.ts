import { readFileSync, existsSync } from "node:fs";
import type { Category, Config } from "./types.js";

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "secrets-config",
    label: "Secrets or credentials files",
    points: 40,
    patterns: ["**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.p12", "**/credentials", "**/credentials.*", "**/*secret*"],
    exclude: ["**/*.{example,sample,template,dist}", "**/*.{example,sample,template}.*"],
  },
  {
    id: "database-migrations",
    label: "Database migrations or schema",
    points: 35,
    patterns: ["**/migrations/**", "**/migrate/**", "**/alembic/**", "**/*.sql", "**/schema.prisma", "**/db/schema.rb"],
  },
  {
    id: "auth-security",
    label: "Authentication, admin or permissions",
    points: 30,
    patterns: [
      "**/{auth,authn,authz,oauth,sso,security,permissions,rbac,iam,admin}/**",
      "**/{auth,oauth,jwt,session,sessions,permissions,login,mfa,admin}.*",
      "**/*{-,_,.}{auth,oauth,jwt,session,permission,permissions,mfa}{.,-,_}*",
    ],
  },
  {
    id: "payments-money",
    label: "Payments, billing or ledger",
    points: 30,
    patterns: [
      "**/{payment,payments,billing,ledger,wallet,invoices,checkout}/**",
      "**/*{payment,billing,ledger,wallet,invoice,refund}*.*",
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure as code or runtime config",
    points: 30,
    patterns: [
      "**/*.tf",
      "**/*.tfvars",
      "**/terraform/**",
      "**/cdk/**",
      "**/helm/**",
      "**/{k8s,kubernetes}/**",
      "Dockerfile",
      "**/docker-compose*.{yml,yaml}",
      "**/serverless.{yml,yaml}",
      "**/vercel.json",
    ],
  },
  {
    id: "ci-cd",
    label: "CI/CD pipeline",
    points: 20,
    patterns: [".github/workflows/**", ".github/actions/**", ".buildkite/**", ".circleci/**", ".gitlab-ci.yml", "Jenkinsfile"],
  },
  {
    id: "public-api",
    label: "Public API contract",
    points: 20,
    patterns: ["**/openapi*.{yml,yaml,json}", "**/swagger*.{yml,yaml,json}", "**/*.proto", "**/*.graphql", "**/*.gql"],
  },
  {
    id: "dependencies",
    label: "Dependencies",
    points: 10,
    patterns: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lockb",
      "requirements*.txt",
      "poetry.lock",
      "pyproject.toml",
      "uv.lock",
      "go.mod",
      "go.sum",
      "Cargo.toml",
      "Cargo.lock",
      "Gemfile",
      "Gemfile.lock",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
    ],
  },
];

export const DEFAULT_CONFIG: Config = {
  thresholds: { critical: 60, significant: 25 },
  categories: DEFAULT_CATEGORIES,
  testPatterns: [
    "**/{test,tests,__tests__,spec,specs,e2e,cypress,playwright}/**",
    "**/*.{test,spec}.*",
    "**/*_test.{go,py,rb,exs}",
    "**/test_*.py",
    "**/*Test.{java,kt}",
    "**/*Tests.{java,kt,cs,swift}",
  ],
  docPatterns: ["**/*.md", "**/*.mdx", "**/*.rst", "**/*.txt", "docs/**", "**/LICENSE", "**/CHANGELOG*"],
  size: {
    largeLines: 400,
    largePoints: 15,
    hugeLines: 1000,
    hugePoints: 25,
    manyFiles: 40,
    manyFilesPoints: 10,
  },
  untestedLines: 150,
};

/** User overrides. Categories with a known id replace the default; new ids are added; `points: 0` disables one. */
export interface ConfigOverrides {
  thresholds?: Partial<Config["thresholds"]>;
  categories?: Array<Partial<Category> & { id: string }>;
  testPatterns?: string[];
  docPatterns?: string[];
  size?: Partial<Config["size"]>;
  untestedLines?: number;
}

export function mergeConfig(overrides: ConfigOverrides = {}): Config {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, patterns: [...c.patterns] }));
  for (const o of overrides.categories ?? []) {
    const existing = categories.find((c) => c.id === o.id);
    if (existing) Object.assign(existing, o);
    else categories.push({ label: o.id, points: 10, patterns: [], ...o });
  }
  return {
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...overrides.thresholds },
    categories: categories.filter((c) => c.points > 0 && c.patterns.length > 0),
    testPatterns: overrides.testPatterns ?? DEFAULT_CONFIG.testPatterns,
    docPatterns: overrides.docPatterns ?? DEFAULT_CONFIG.docPatterns,
    size: { ...DEFAULT_CONFIG.size, ...overrides.size },
    untestedLines: overrides.untestedLines ?? DEFAULT_CONFIG.untestedLines,
  };
}

export function parseOverrides(text: string, source: string): ConfigOverrides {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("expected a JSON object");
    }
    return parsed as ConfigOverrides;
  } catch (err) {
    throw new Error(`pr-risk: could not read config ${source}: ${(err as Error).message}`);
  }
}

export function loadConfigFile(path: string | undefined): Config {
  if (!path || !existsSync(path)) return mergeConfig();
  return mergeConfig(parseOverrides(readFileSync(path, "utf8"), path));
}
