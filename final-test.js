import { gogCalendarListTool } from './src/tools/google.js';

async function test() {
    console.log("--- FINAL VERIFICATION: CALENDAR ---");
    const now = new Date();
    const tonight = new Date();
    tonight.setHours(23, 59, 59);

    try {
        const result = await gogCalendarListTool.execute({
            timeMin: now.toISOString(),
            timeMax: tonight.toISOString()
        });
        console.log("Result:\n", result);
        console.log("\n✅ ALL SYSTEMS GREEN");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
