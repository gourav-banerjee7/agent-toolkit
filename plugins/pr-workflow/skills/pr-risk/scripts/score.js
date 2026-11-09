import { matchesAny } from "./glob.js";
import { findSecret } from "./secrets.js";
const SKIPPED_TEST_RE = /\b(?:it|test|describe|context)\.(?:skip|todo)\s*\(|\bx(?:it|describe|test)\s*\(|@pytest\.mark\.skip|\bpytest\.skip\s*\(|@(?:Disabled|Ignore)\b|\bt\.Skip(?:Now|f)?\s*\(|\bskip\s*:\s*true\b/;
const MAX_FILES_LISTED = 5;
function addedLines(patch) {
    if (!patch)
        return [];
    return patch
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1));
}
function pathsOf(file) {
    return file.previousPath ? [file.path, file.previousPath] : [file.path];
}
export function scorePullRequest(files, config) {
    const signals = [];
    const isTest = (f) => matchesAny(f.path, config.testPatterns);
    const isDoc = (f) => matchesAny(f.path, config.docPatterns);
    const additions = files.reduce((n, f) => n + f.additions, 0);
    const deletions = files.reduce((n, f) => n + f.deletions, 0);
    const changed = additions + deletions;
    const testFiles = files.filter(isTest);
    // 1. Sensitive areas. Each category counts once, however many files hit it.
    for (const category of config.categories) {
        const exclude = category.exclude ?? [];
        const hits = files.filter((f) => pathsOf(f).some((p) => matchesAny(p, category.patterns) && !matchesAny(p, exclude)));
        if (hits.length === 0)
            continue;
        signals.push({
            id: category.id,
            label: category.label,
            points: category.points,
            detail: `${hits.length} file${hits.length === 1 ? "" : "s"} touched`,
            files: hits.map((f) => f.path),
        });
    }
    // 2. Secrets in added lines. Forces critical.
    const secretHits = [];
    const secretKinds = new Set();
    for (const f of files) {
        for (const line of addedLines(f.patch)) {
            const kind = findSecret(line);
            if (kind) {
                secretKinds.add(kind);
                if (!secretHits.includes(f.path))
                    secretHits.push(f.path);
            }
        }
    }
    if (secretHits.length > 0) {
        signals.push({
            id: "secret-in-diff",
            label: "Possible secret added",
            points: 50,
            detail: [...secretKinds].join(", "),
            files: secretHits,
            forcesCritical: true,
        });
    }
    // 3. Size.
    const { size } = config;
    if (changed >= size.hugeLines) {
        signals.push({ id: "size-huge", label: "Very large diff", points: size.hugePoints, detail: `${changed} lines changed`, files: [] });
    }
    else if (changed >= size.largeLines) {
        signals.push({ id: "size-large", label: "Large diff", points: size.largePoints, detail: `${changed} lines changed`, files: [] });
    }
    if (files.length >= size.manyFiles) {
        signals.push({ id: "many-files", label: "Many files", points: size.manyFilesPoints, detail: `${files.length} files changed`, files: [] });
    }
    // 4. Tests removed, skipped, or missing.
    const removedTests = testFiles.filter((f) => f.status === "removed");
    if (removedTests.length > 0) {
        signals.push({
            id: "tests-removed",
            label: "Test files deleted",
            points: 20,
            detail: `${removedTests.length} test file${removedTests.length === 1 ? "" : "s"} deleted`,
            files: removedTests.map((f) => f.path),
        });
    }
    else {
        const testAdds = testFiles.reduce((n, f) => n + f.additions, 0);
        const testDels = testFiles.reduce((n, f) => n + f.deletions, 0);
        if (testDels - testAdds >= 20) {
            signals.push({
                id: "tests-shrunk",
                label: "Net test lines removed",
                points: 10,
                detail: `${testDels - testAdds} more test lines removed than added`,
                files: testFiles.filter((f) => f.deletions > f.additions).map((f) => f.path),
            });
        }
    }
    const skipped = files.filter((f) => addedLines(f.patch).some((l) => SKIPPED_TEST_RE.test(l)));
    if (skipped.length > 0) {
        signals.push({
            id: "tests-skipped",
            label: "Tests skipped or disabled",
            points: 15,
            detail: `skip markers added in ${skipped.length} file${skipped.length === 1 ? "" : "s"}`,
            files: skipped.map((f) => f.path),
        });
    }
    const codeFiles = files.filter((f) => !isTest(f) && !isDoc(f));
    const codeLines = codeFiles.reduce((n, f) => n + f.additions + f.deletions, 0);
    if (testFiles.length === 0 && codeLines >= config.untestedLines) {
        signals.push({
            id: "no-tests",
            label: "No test changes",
            points: 10,
            detail: `${codeLines} lines of code changed with no test files touched`,
            files: [],
        });
    }
    for (const s of signals)
        s.files = s.files.slice(0, MAX_FILES_LISTED);
    signals.sort((a, b) => b.points - a.points);
    const docsOnly = files.length > 0 && files.every(isDoc);
    const score = docsOnly && secretHits.length === 0 ? 0 : signals.reduce((n, s) => n + s.points, 0);
    const level = levelFor(score, signals, config);
    return {
        level,
        score,
        signals: docsOnly && secretHits.length === 0 ? [] : signals,
        stats: { files: files.length, additions, deletions, testFiles: testFiles.length },
        reviewMinutes: estimateReviewMinutes(changed, level),
    };
}
function levelFor(score, signals, config) {
    if (signals.some((s) => s.forcesCritical) || score >= config.thresholds.critical)
        return "critical";
    if (score >= config.thresholds.significant)
        return "significant";
    return "routine";
}
/** ~5 minutes per 100 changed lines, padded for risk, clamped to 5..120 and rounded to 5. */
export function estimateReviewMinutes(changedLines, level) {
    const base = (changedLines / 100) * 5;
    const factor = level === "critical" ? 1.5 : level === "significant" ? 1.2 : 1;
    const minutes = Math.min(120, Math.max(5, base * factor));
    return Math.round(minutes / 5) * 5;
}
