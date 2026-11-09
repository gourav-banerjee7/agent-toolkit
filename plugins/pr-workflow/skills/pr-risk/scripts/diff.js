/**
 * Parse `git diff` unified output into ChangedFile records.
 * Handles added, deleted, renamed and binary files.
 */
export function parseUnifiedDiff(diff) {
    const files = [];
    const lines = diff.replace(/\r\n/g, "\n").split("\n");
    let current;
    let patch = [];
    let inHunk = false;
    const flush = () => {
        if (!current)
            return;
        if (patch.length > 0)
            current.patch = patch.join("\n");
        files.push(current);
    };
    for (const line of lines) {
        const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
        if (header) {
            flush();
            current = { path: header[2], status: "modified", additions: 0, deletions: 0 };
            if (header[1] !== header[2]) {
                current.previousPath = header[1];
                current.status = "renamed";
            }
            patch = [];
            inHunk = false;
            continue;
        }
        if (!current)
            continue;
        if (!inHunk) {
            if (line.startsWith("new file mode"))
                current.status = "added";
            else if (line.startsWith("deleted file mode"))
                current.status = "removed";
            else if (line.startsWith("rename from ")) {
                current.previousPath = line.slice("rename from ".length);
                current.status = "renamed";
            }
            else if (line.startsWith("rename to "))
                current.path = line.slice("rename to ".length);
            else if (line.startsWith("+++ ") && line !== "+++ /dev/null")
                current.path = line.slice(4).replace(/^b\//, "");
            else if (line.startsWith("--- ") && line !== "--- /dev/null" && current.status === "removed") {
                current.path = line.slice(4).replace(/^a\//, "");
            }
        }
        if (line.startsWith("@@")) {
            inHunk = true;
            patch.push(line);
            continue;
        }
        if (!inHunk)
            continue;
        if (line.startsWith("+"))
            current.additions++;
        else if (line.startsWith("-"))
            current.deletions++;
        patch.push(line);
    }
    flush();
    return files;
}
