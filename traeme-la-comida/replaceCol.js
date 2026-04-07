import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determinar la ruta relativa al directorio src del frontend
const root = path.resolve(__dirname, './src');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            processDir(p);
        } else if (p.endsWith('.css') || p.endsWith('.jsx') || p.endsWith('.js')) {
            // Excluimos archivos que necesitan los valores fijos para fallbacks o estados iniciales
            if (f === 'App.jsx' || f === 'DatosNegocio.jsx') continue;

            let content = fs.readFileSync(p, 'utf8');
            let changed = false;
            
            // 1. Eliminar definiciones locales que pisan la variable global
            const cssMatch = /--primary(-cliente)?:\s*#ec9213;?\s*/g;
            if (cssMatch.test(content)) {
                content = content.replace(cssMatch, '');
                changed = true;
            }

            // 2. Reemplazar el color hexadecimal por la variable CSS
            // Naranja principal
            if (content.includes('#ec9213')) {
                content = content.replace(/#ec9213/g, 'var(--primary)');
                changed = true;
            }
            
            // Color suave/fondo (Soft Orange)
            if (content.includes('#fff7ed')) {
                content = content.replace(/#fff7ed/g, 'var(--primary-soft)');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(p, content, 'utf8');
                console.log('✅ Updated:', path.relative(process.cwd(), p));
            }
        }
    }
}

console.log('🚀 Iniciando normalización de colores en:', root);
if (fs.existsSync(root)) {
    processDir(root);
    console.log('✨ Proceso finalizado.');
} else {
    console.error('❌ No se encontró el directorio src en:', root);
}
