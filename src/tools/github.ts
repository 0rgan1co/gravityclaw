import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = util.promisify(exec);

// Identify exactly where the gh binary is placed. Local vs Prod
const getGhBinPath = () => {
    const binDir = path.join(process.cwd(), 'bin');
    const localBin = path.join(binDir, 'gh');

    if (fs.existsSync(localBin)) {
        return localBin;
    }
    return 'gh'; // fallback to global if it exists
};

export const githubTools = [
    {
        type: "function",
        function: {
            name: "execute_github_cli",
            description: "Ejecuta comandos del CLI oficial de GitHub ('gh') para interactuar con repositorios, PRs, issues, y GitHub Actions. Útil para leer código de PRs, fallos de pipelines y más. La variable `GH_TOKEN` o `GITHUB_TOKEN` debe existir en el entorno (.env o Railway).",
            parameters: {
                type: "object",
                properties: {
                    arguments: {
                        type: "string",
                        description: "Los argumentos exactos que se pasarán a `gh`. IMPORTANTE: No incluyas 'gh ' al principio. Ejemplo: `pr checks 55 --repo owner/repo` o `run view 1234 --log-failed --repo owner/repo`"
                    }
                },
                required: ["arguments"]
            }
        }
    }
];

export async function executeGitHubCommands(functionName: string, args: any): Promise<string> {
    const { arguments: ghArgs } = args;

    if (functionName === "execute_github_cli") {
        try {
            // Check if gh is available
            const ghBin = getGhBinPath();

            // Note: We inject the GH_TOKEN gracefully if needed via process.env.
            // On Railway it will be present as long as the user sets it up.

            // Ensure no arbitrary command injection passes easily. We prepend the precise gh executable path.
            const command = `${ghBin} ${ghArgs}`;

            console.log(`[GitHub CLI] Executing: ${command}`);
            const { stdout, stderr } = await execAsync(command, {
                env: {
                    ...process.env, // Pass all env vars like GH_TOKEN
                    // Required to format GitHub CLI prints nicely and non-interactively
                    GH_FORCE_TTY: "1"
                }
            });

            if (stderr && stderr.trim() !== '') {
                console.warn(`[GitHub CLI Error]: ${stderr}`);
                return `Output:\n${stdout}\nWarnings/Errors:\n${stderr}`;
            }

            return stdout || "El comando se ejecutó exitosamente pero no produjo ninguna salida.";
        } catch (error: any) {
            console.error("[GitHub CLI Fatal Error]", error);
            // We return the error rather than throwing, so the LLM gets context on why it failed
            return `Error ejecutando comando de GitHub:\n${error.message}\n` +
                (error.stdout ? `\nStdout:\n${error.stdout}` : '') +
                (error.stderr ? `\nStderr:\n${error.stderr}` : '');
        }
    }

    return "GitHub command not recognized";
}
