import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, mergeConfig } from "../src/config.js";
import { estimateReviewMinutes, scorePullRequest } from "../src/score.js";
import { addedPatch, FAKE_AWS_KEY, file } from "./helpers.js";

const ids = (r: ReturnType<typeof scorePullRequest>) => r.signals.map((s) => s.id);

describe("scorePullRequest", () => {
  it("rates a small feature with tests as routine", () => {
    const r = scorePullRequest([file("src/cart/total.ts"), file("src/cart/total.test.ts")], DEFAULT_CONFIG);
    expect(r.level).toBe("routine");
    expect(r.score).toBe(0);
  });

  it("rates a migration plus deleted tests as critical", () => {
    const r = scorePullRequest(
      [
        file("db/migrations/0042_drop_column.sql"),
        file("src/orders/repo.ts"),
        file("src/orders/repo.test.ts", { status: "removed", additions: 0, deletions: 80 }),
      ],
      DEFAULT_CONFIG,
    );
    expect(ids(r)).toEqual(expect.arrayContaining(["database-migrations", "tests-removed"]));
    expect(r.score).toBe(55);
    expect(r.level).toBe("significant");
  });

  it("adds up several sensitive areas to critical", () => {
    const r = scorePullRequest(
      [file("src/auth/session.ts"), file("infra/rds.tf"), file("db/migrations/1.sql")],
      DEFAULT_CONFIG,
    );
    expect(r.level).toBe("critical");
    expect(r.score).toBe(95);
  });

  it("counts a category once however many files hit it", () => {
    const r = scorePullRequest([file("infra/a.tf"), file("infra/b.tf"), file("infra/c.tf")], DEFAULT_CONFIG);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0]!.files).toHaveLength(3);
  });

  it("forces critical when a secret is added, even in a tiny PR", () => {
    const r = scorePullRequest(
      [file("src/config.ts", { additions: 1, deletions: 0, patch: addedPatch([`const key = "${FAKE_AWS_KEY}";`]) })],
      DEFAULT_CONFIG,
    );
    expect(r.level).toBe("critical");
    expect(r.signals[0]!.id).toBe("secret-in-diff");
    expect(r.signals[0]!.detail).toContain("AWS");
  });

  it("ignores secrets on lines marked secret-scan:allow", () => {
    const r = scorePullRequest(
      [file("docs/example.ts", { patch: addedPatch([`"${FAKE_AWS_KEY}" // secret-scan:allow`]) })],
      DEFAULT_CONFIG,
    );
    expect(ids(r)).not.toContain("secret-in-diff");
  });

  it("flags skipped tests", () => {
    const r = scorePullRequest(
      [file("src/pay.test.ts", { patch: addedPatch(["it.skip('charges once', () => {})"]) })],
      DEFAULT_CONFIG,
    );
    expect(ids(r)).toContain("tests-skipped");
  });

  it("flags pytest skips and Go t.Skip", () => {
    const r = scorePullRequest(
      [
        file("tests/test_api.py", { patch: addedPatch(["@pytest.mark.skip(reason='flaky')"]) }),
        file("pkg/api_test.go", { patch: addedPatch(["\tt.Skip(\"later\")"]) }),
      ],
      DEFAULT_CONFIG,
    );
    expect(r.signals.find((s) => s.id === "tests-skipped")!.files).toHaveLength(2);
  });

  it("flags large code changes with no tests", () => {
    const r = scorePullRequest([file("src/engine.ts", { additions: 300, deletions: 50 })], DEFAULT_CONFIG);
    expect(ids(r)).toEqual(expect.arrayContaining(["no-tests"]));
  });

  it("does not flag missing tests when only docs changed", () => {
    const r = scorePullRequest([file("docs/guide.md", { additions: 900 })], DEFAULT_CONFIG);
    expect(r.level).toBe("routine");
    expect(r.signals).toEqual([]);
  });

  it("still catches a secret in a docs-only PR", () => {
    const r = scorePullRequest(
      [file("README.md", { patch: addedPatch([`token: ${FAKE_AWS_KEY}`]) })],
      DEFAULT_CONFIG,
    );
    expect(r.level).toBe("critical");
  });

  it("scores the old path of a renamed file", () => {
    const r = scorePullRequest(
      [file("src/legacy/old.ts", { status: "renamed", previousPath: "src/auth/old.ts" })],
      DEFAULT_CONFIG,
    );
    expect(ids(r)).toContain("auth-security");
  });

  it("does not treat env templates as secrets files", () => {
    const r = scorePullRequest([file(".env.example"), file("config/secrets.sample.yml"), file(".env.local")], DEFAULT_CONFIG);
    expect(r.signals.find((s) => s.id === "secrets-config")!.files).toEqual([".env.local"]);
  });

  it("does not treat author.ts as auth code", () => {
    const r = scorePullRequest([file("src/blog/author.ts")], DEFAULT_CONFIG);
    expect(ids(r)).not.toContain("auth-security");
  });

  it("applies size signals", () => {
    const big = scorePullRequest([file("src/a.ts", { additions: 1200 }), file("src/a.test.ts")], DEFAULT_CONFIG);
    expect(ids(big)).toContain("size-huge");
  });
});

describe("mergeConfig", () => {
  it("lets a repo add its own category", () => {
    const config = mergeConfig({ categories: [{ id: "booking", label: "Booking engine", points: 40, patterns: ["src/booking/**"] }] });
    const r = scorePullRequest([file("src/booking/state.ts")], config);
    expect(ids(r)).toEqual(["booking"]);
    expect(r.level).toBe("significant");
  });

  it("lets a repo turn a category off with points: 0", () => {
    const config = mergeConfig({ categories: [{ id: "dependencies", points: 0 }] });
    const r = scorePullRequest([file("package.json")], config);
    expect(r.signals).toEqual([]);
  });

  it("lets a repo change thresholds", () => {
    const config = mergeConfig({ thresholds: { critical: 30 } });
    const r = scorePullRequest([file("infra/main.tf")], config);
    expect(r.level).toBe("critical");
  });
});

describe("estimateReviewMinutes", () => {
  it("clamps and rounds", () => {
    expect(estimateReviewMinutes(10, "routine")).toBe(5);
    expect(estimateReviewMinutes(400, "routine")).toBe(20);
    expect(estimateReviewMinutes(400, "critical")).toBe(30);
    expect(estimateReviewMinutes(50_000, "critical")).toBe(120);
  });
});
