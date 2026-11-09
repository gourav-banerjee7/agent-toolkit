export const COMMENT_MARKER = "<!-- pr-risk -->";
export const LEVEL_META = {
    critical: {
        emoji: "🔴",
        title: "Critical",
        label: "risk: critical",
        color: "B60205",
        advice: "Get a second reviewer and plan the rollback before merging.",
    },
    significant: {
        emoji: "🟡",
        title: "Significant",
        label: "risk: significant",
        color: "FBCA04",
        advice: "Review the flagged areas closely.",
    },
    routine: {
        emoji: "🟢",
        title: "Routine",
        label: "risk: routine",
        color: "0E8A16",
        advice: "Normal review.",
    },
};
export const ALL_LABELS = Object.values(LEVEL_META).map((m) => m.label);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Markdown for a PR comment or job summary. Leads with the level and the next action. */
export function toMarkdown(report) {
    const meta = LEVEL_META[report.level];
    const { stats } = report;
    const out = [COMMENT_MARKER];
    out.push(`### ${meta.emoji} PR risk: ${meta.title} (score ${report.score})`);
    out.push("");
    out.push(`**Next:** ${meta.advice} ⏱ ~${report.reviewMinutes} min review.`);
    out.push("");
    if (report.signals.length === 0) {
        out.push("No risk signals found.");
    }
    else {
        out.push("| Signal | Points | Why |");
        out.push("|---|---:|---|");
        for (const s of report.signals) {
            const files = s.files.length > 0 ? `<br>${s.files.map((f) => `\`${f}\``).join(", ")}` : "";
            out.push(`| ${s.label} | ${s.forcesCritical ? `${s.points} ⚠️` : s.points} | ${s.detail}${files} |`);
        }
    }
    out.push("");
    out.push(`<sub>${plural(stats.files, "file")} · +${stats.additions} / −${stats.deletions} · ${plural(stats.testFiles, "test file")} · ` +
        `scored by rules, not an LLM — [how it works](https://github.com/gourav-banerjee7/agent-toolkit/tree/main/pr-risk)</sub>`);
    return out.join("\n");
}
/** Plain text for terminals and for the Claude skill to read. */
export function toText(report) {
    const meta = LEVEL_META[report.level];
    const out = [];
    out.push(`${meta.emoji} ${meta.title.toUpperCase()} — score ${report.score} — ~${report.reviewMinutes} min review`);
    out.push(`Next: ${meta.advice}`);
    out.push(`${plural(report.stats.files, "file")}, +${report.stats.additions}/-${report.stats.deletions}, ${plural(report.stats.testFiles, "test file")}`);
    if (report.signals.length === 0) {
        out.push("No risk signals found.");
    }
    else {
        out.push("Signals:");
        for (const s of report.signals) {
            out.push(`  [+${s.points}] ${s.label}: ${s.detail}${s.forcesCritical ? " (forces critical)" : ""}`);
            for (const f of s.files)
                out.push(`      ${f}`);
        }
    }
    return out.join("\n");
}
