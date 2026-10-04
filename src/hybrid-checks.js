/**
 * Hybrid check: Verify epic link exists in GitHub.
 * @param {Object} issue - Issue object
 * @param {string} epicIssueNumber - Extracted epic issue number
 * @returns {Object} Check result
 */
export async function checkEpicLinkHybrid(issue, epicIssueNumber) {
    const { getIssue } = await import('./tools.js');

    try {
        const epicIssue = await getIssue(parseInt(epicIssueNumber));

        // Check if epic exists
        if (!epicIssue || epicIssue.number !== parseInt(epicIssueNumber)) {
            return {
                passed: false,
                evidence: `Referenced epic #${epicIssueNumber} does not exist.`,
            };
        }

        // Check if child story has backlink (optional but recommended)
        const hasBacklink = issue.body?.includes(`Epic: #${epicIssueNumber}`) ||
            issue.body?.includes(`Relates to #${epicIssueNumber}`);

        // Check if epic lists this story (optional)
        // This would require loading the epic reference or checking epic's childStories

        return {
            passed: true,
            evidence: `Epic #${epicIssueNumber} exists. Backlink: ${hasBacklink ? 'yes' : 'no'}.`,
        };
    } catch (error) {
        return {
            passed: false,
            evidence: `Failed to verify epic link: ${error.message}`,
        };
    }
}