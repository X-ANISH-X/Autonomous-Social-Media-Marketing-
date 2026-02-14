// Run with: npx tsx scripts/agent-runner.ts <PROJECT_ID>
import { runAgentCycle } from '../src/lib/agent';
import { getProjects } from '../src/lib/db';

const INTERVAL_MINUTES = 60; // Run every hour

async function main() {
    const args = process.argv.slice(2);
    let projectId = args[0];

    if (!projectId) {
        // Default to first project if not specified
        const projects = getProjects();
        if (projects.length > 0) {
            projectId = projects[0].id;
            console.log(`No project ID provided, using first project: ${projects[0].name} (${projectId})`);
        } else {
            console.error('No projects found. Please create a project first.');
            process.exit(1);
        }
    }

    console.log(`[Runner] Starting Agent Loop for Project: ${projectId}`);
    console.log(`[Runner] Interval: ${INTERVAL_MINUTES} minutes`);

    // Initial run
    await runCycleSafe(projectId);

    // Loop
    setInterval(async () => {
        await runCycleSafe(projectId);
    }, INTERVAL_MINUTES * 60 * 1000);
}

async function runCycleSafe(projectId: string) {
    console.log(`\n--- [${new Date().toISOString()}] Starting Cycle ---`);
    try {
        const result = await runAgentCycle(projectId);
        console.log('--- Cycle Result ---');
        console.log(`Content: ${result.contentGenerated}, Images: ${result.imagesGenerated}, Posts: ${result.postsPublished}`);
        console.log(`Leads Discovered: ${result.leadsDiscovered}, Engaged: ${result.leadsEngaged}`);
        if (result.errors.length > 0) {
            console.error('Errors:', result.errors);
        }
    } catch (err) {
        console.error('CRITICAL RUNNER ERROR:', err);
    }
    console.log(`--- Cycle End ---`);
}

main();
