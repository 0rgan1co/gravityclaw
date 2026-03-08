import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

async function downloadGh() {
    const platform = os.platform();
    const arch = os.arch();
    let url = "";

    // Determine the right binary based on platform
    if (platform === 'linux' && arch === 'x64') {
        url = "https://github.com/cli/cli/releases/download/v2.45.0/gh_2.45.0_linux_amd64.tar.gz";
    } else if (platform === 'darwin' && arch === 'arm64') {
        url = "https://github.com/cli/cli/releases/download/v2.45.0/gh_2.45.0_macOS_arm64.zip";
    } else if (platform === 'darwin' && arch === 'x64') {
        url = "https://github.com/cli/cli/releases/download/v2.45.0/gh_2.45.0_macOS_amd64.zip";
    } else {
        console.log(`[Setup] Skipping automatic 'gh' installation for platform ${platform} ${arch}.`);
        return;
    }

    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

    const localGhPath = path.join(binDir, 'gh');
    if (fs.existsSync(localGhPath)) {
        console.log("[Setup] GitHub CLI (gh) already installed in ./bin/gh");
        // Update permissions just in case
        execSync(`chmod +x ${localGhPath}`);
        return;
    }

    console.log(`[Setup] Downloading GitHub CLI from ${url}...`);

    try {
        if (url.endsWith('.tar.gz')) {
            const tarPath = path.join('/tmp', 'gh.tar.gz');
            execSync(`curl -L -o ${tarPath} ${url}`);
            execSync(`tar -xzf ${tarPath} -C /tmp`);
            const extractedBin = path.join('/tmp', 'gh_2.45.0_linux_amd64', 'bin', 'gh');
            fs.copyFileSync(extractedBin, localGhPath);
        } else if (url.endsWith('.zip')) {
            const zipPath = path.join('/tmp', 'gh.zip');
            execSync(`curl -L -o ${zipPath} ${url}`);
            const folderName = arch === 'arm64' ? 'gh_2.45.0_macOS_arm64' : 'gh_2.45.0_macOS_amd64';
            execSync(`unzip -o ${zipPath} -d /tmp`);
            const extractedBin = path.join('/tmp', folderName, 'bin', 'gh');
            fs.copyFileSync(extractedBin, localGhPath);
        }

        execSync(`chmod +x ${localGhPath}`);
        console.log("[Setup] GitHub CLI installed successfully to ./bin/gh!");

    } catch (e: any) {
        console.error("[Setup] Failed to download or install GitHub CLI.", e.message);
    }
}

downloadGh().catch(console.error);
