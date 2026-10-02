import { listIssues, getIssue } from "./tools.js";

async function test() {
    console.log("Testing listIssues()...");
    const issues = await listIssues();
    console.log(`Found ${issues.length} issues with demo-seed label:`);
    for (const issue of issues) {
        console.log(`  #${issue.number}: ${issue.title} [${issue.labels.join(", ")}]`);
    }

    console.log("\\nTesting getIssue(3)...");
    const issue3 = await getIssue(3);
    console.log(`  #${issue3.number}: ${issue3.title}`);
    console.log(`  Body length: ${issue3.body.length} chars`);
    console.log(`  Labels: ${issue3.labels.join(", ")}`);
}

test().catch(console.error);