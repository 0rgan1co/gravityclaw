import { AgentTool } from './index.js';
import fs from 'fs';
import path from 'path';

export const buildSingleFileAppTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "build_single_file_app",
            description: "Crea, compila y envía una aplicación frontend completa (Single Page App) en un único archivo HTML para el usuario.",
            parameters: {
                type: "object",
                properties: {
                    appName: { type: "string", description: "Nombre del archivo (sin extensión, ej. 'productivity-app'). Usa kebab-case." },
                    htmlCode: { type: "string", description: "Esqueleto HTML completo de la aplicación (incluyendo doctype y head)." },
                    cssCode: { type: "string", description: "Código CSS para aplicar diseño premium (evita tailwind, usa puro CSS o glassmorphism) - sin las etiquetas <style>." },
                    jsCode: { type: "string", description: "Código JavaScript completo con toda la lógica - sin las etiquetas <script>." }
                },
                required: ["appName", "htmlCode", "cssCode", "jsCode"],
            },
        },
    },
    execute: async (args: any) => {
        try {
            const appsDir = path.join(process.cwd(), 'apps_generated');
            if (!fs.existsSync(appsDir)) {
                fs.mkdirSync(appsDir, { recursive: true });
            }

            const fileName = `${args.appName.replace(/[^a-z0-9-]/gi, '') || 'app'}.html`;
            const filePath = path.join(appsDir, fileName);

            // Inyectamos el CSS y JS dentro del HTML donde corresponda, o al final del head y body
            let finalHtml = args.htmlCode;

            // Si el HTML ya tiene </body> lo insertamos antes
            const styleTag = `\n<style>\n${args.cssCode}\n</style>\n`;
            const scriptTag = `\n<script>\n${args.jsCode}\n</script>\n`;

            if (finalHtml.includes('</head>')) {
                finalHtml = finalHtml.replace('</head>', `${styleTag}</head>`);
            } else {
                finalHtml += styleTag;
            }

            if (finalHtml.includes('</body>')) {
                finalHtml = finalHtml.replace('</body>', `${scriptTag}</body>`);
            } else {
                finalHtml += scriptTag;
            }

            fs.writeFileSync(filePath, finalHtml, 'utf8');

            // Retornamos la orden al sistema (Index del Bot Telegram) para que agarre y envíe este archivo
            return `¡App generada y guardada con éxito en ${filePath}! <FILE:${filePath}>`;
        } catch (err: any) {
            return `Error creando la app: ${err.message}`;
        }
    },
};
