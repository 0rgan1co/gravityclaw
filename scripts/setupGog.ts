import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

async function setup() {
    if (os.platform() !== 'linux') {
        console.log("[Setup] Skipping gog keyring restore on non-linux platform (using homebrew installed gog).");
        return;
    }

    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir);

    // Make sure our local linux binary is executable
    const localBinLinux = path.join(binDir, 'gog-linux');
    if (fs.existsSync(localBinLinux)) {
        execSync(`chmod +x ${localBinLinux}`);
    } else {
        console.warn("[Setup] Warning: ./bin/gog-linux binary not found in repo. Calling 'gog' might fail if not installed globally.");
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
        execSync(`tar -xzf ${tarPath} -C ${configDir} 2>/dev/null`);

        try {
            console.log("[Setup] Forcing keyring_backend configuration to 'file'");
            const gogCmd = fs.existsSync(localBinLinux) ? localBinLinux : 'gog';
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
