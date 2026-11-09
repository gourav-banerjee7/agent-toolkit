/**
 * High-confidence secret patterns. Kept deliberately narrow: a false positive here
 * forces a PR to critical, so only formats with a distinctive prefix or shape are listed.
 */
export const SECRET_PATTERNS = [
    { name: "AWS access key ID", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
    { name: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
    { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
    { name: "Slack webhook", re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/ },
    { name: "Stripe live key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
    { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{30,}\b/ },
    { name: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
];
/** Lines carrying this marker are skipped, for test fixtures and documented examples. */
export const ALLOW_MARKER = "secret-scan:allow";
export function findSecret(line) {
    if (line.includes(ALLOW_MARKER))
        return undefined;
    return SECRET_PATTERNS.find((p) => p.re.test(line))?.name;
}
