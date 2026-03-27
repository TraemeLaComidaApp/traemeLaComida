const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            processDir(p);
        } else if (p.endsWith('.css') || p.endsWith('.jsx') || p.endsWith('.js')) {
            let content = fs.readFileSync(p, 'utf8');
            let changed = false;
            
            // Reemplazar definiciones previas que pisan el :root
            const cssMatch = /--primary(-cliente)?:\s*#ec9213;?\s*/g;
            if (cssMatch.test(content)) {
                content = content.replace(cssMatch, '');
                changed = true;
            }

            // En JS, si hay #ec9213, cambiar a var(--primary). Cuidado con los objetos de estilo en React
            // En React: color: '#ec9213' -> color: 'var(--primary)'
            // Usaremos replace para cambiar el hex directamente.
            if (content.includes('#ec9213')) {
                content = content.replace(/#ec9213/g, 'var(--primary)');
                changed = true;
            }
            if (content.includes('#fff7ed')) {
                content = content.replace(/#fff7ed/g, 'var(--primary-soft)');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(p, content, 'utf8');
                console.log('Updated', p);
            }
        }
    }
}

const root = path.join('c:\\Users\\Lÿ\\traemeLaComida\\traeme-la-comida', 'src');
processDir(root);
