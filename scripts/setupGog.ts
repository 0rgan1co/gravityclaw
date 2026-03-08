import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

async function setup() {
    if (os.platform() !== 'linux') {
        console.log("[Setup] Skipping gogcli download on non-linux platform (using homebrew installed gog).");
        return;
    }

    const gogUrl = 'https://github.com/steipete/gogcli/releases/download/v0.11.0/gogcli_0.11.0_linux_amd64.tar.gz';
    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir);

    // Check if gog is already downloaded
    if (!fs.existsSync(path.join(binDir, 'gog'))) {
        console.log("[Setup] Downloading gogcli for Linux...");
        try {
            execSync(`curl -sL ${gogUrl} | tar -xz -C ${binDir} gog`);
            execSync(`chmod +x ${binDir}/gog`);
            console.log("[Setup] gogcli installed to ./bin/gog");
        } catch (err) {
            console.error("[Setup] Error downloading/installing gog:", err);
            // Optionally process.exit(1) to fail the build if required
        }
    }

    if (process.env.GOGCLI_CREDENTIALS_B64) {
        console.log("[Setup] Found GOGCLI_CREDENTIALS_B64, restoring keyring to ~/.config/gogcli...");
        const homeDir = os.homedir();
        const configDir = path.join(homeDir, '.config', 'gogcli');

        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const tarPath = path.join('/tmp', 'gog-creds.tar.gz');
        fs.writeFileSync(tarPath, Buffer.from(process.env.GOGCLI_CREDENTIALS_B64, 'base64'));
        execSync(`tar -xzf ${tarPath} -C ${configDir}`);

        try {
            console.log("[Setup] Forcing keyring_backend configuration to 'file'");
            const gogCmd = fs.existsSync(path.join(binDir, 'gog')) ? path.join(binDir, 'gog') : 'gog';
            execSync(`${gogCmd} config set keyring_backend file`);
        } catch (e) {
            console.error("[Setup] Warning: Could not configure keyring_backend. Continuing.", e);
        }

        console.log("[Setup] Keyring restored successfully.");
    } else {
        console.warn("[Setup] Warning: GOGCLI_CREDENTIALS_B64 environment variable not found.");
    }
}

setup().catch(console.error);
