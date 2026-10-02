import { checkStoryFormat, checkContext, checkEpicLink, checkACPresence } from "./checks.js";
import { getIssue } from "./tools.js";

async function test() {
    console.log("Testing checks on Issue #3 (Improve login)...");
    const issue3 = await getIssue(3);

    console.log("\\n1. Story Format:");
    console.log(checkStoryFormat(issue3.body));

    console.log("\\n2. Context:");
    console.log(checkContext(issue3.body));

    console.log("\\n3. Epic Link:");
    console.log(checkEpicLink(issue3.body));

    console.log("\\n4. AC Presence:");
    console.log(checkACPresence(issue3.body));

    console.log("\\n\\nTesting checks on Issue #2 (Download invoice as PDF - good control)...");
    const issue2 = await getIssue(2);

    console.log("\\n1. Story Format:");
    console.log(checkStoryFormat(issue2.body));

    console.log("\\n2. Context:");
    console.log(checkContext(issue2.body));

    console.log("\\n3. Epic Link:");
    console.log(checkEpicLink(issue2.body));

    console.log("\\n4. AC Presence:");
    console.log(checkACPresence(issue2.body));
}

test().catch(console.error);