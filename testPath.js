const path = require('path');
const fs = require('fs');

const i18nPath = path.resolve(__dirname, 'traeme-la-comida/src/i18n.js');
console.log('Resolving from root:', i18nPath);
console.log('Exists:', fs.existsSync(i18nPath));

const i18nPathFromBackend = path.resolve(__dirname, 'traeme-la-comida-backend/src/voice/../../../../traeme-la-comida/src/i18n.js');
console.log('Resolving from backend relative:', i18nPathFromBackend);
console.log('Exists:', fs.existsSync(i18nPathFromBackend));
