import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly groqApiKey: string;

  constructor(private configService: ConfigService) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
  }

  async transcribe(file: Express.Multer.File): Promise<string> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured in backend');
    }

    try {
      const formData = new FormData();
      // Convert buffer to Uint8Array for Blob compatibility
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'json');

      this.logger.log(`Enviando audio a Groq (${file.size} bytes)...`);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Error de Groq API: ${response.status} - ${errorText}`);
        throw new Error(`Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      this.logger.error('Error durante la transcripción:', error);
      throw error;
    }
  }

  async translate(text: string): Promise<any> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const prompt = `Translate the following restaurant menu item/category to English (en), French (fr), and German (de). 
    Return ONLY a JSON object with the keys 'en', 'fr', 'de'.
    Input: "${text}"`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) throw new Error('Groq Translation failed');
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      this.logger.error('Error in translate:', error);
      return { en: text, fr: text, de: text }; // Fallback
    }
  }

  async addTranslationsToFile(key: string, translations: { es: string, en: string, fr: string, de: string }): Promise<void> {
    try {
      // Usar cwd() es más fiable si el backend se lanza desde su propia carpeta
      const i18nPath = path.resolve(process.cwd(), '../traeme-la-comida/src/i18n.js');
      this.logger.log(`Intentando actualizar i18n.js en: ${i18nPath}`);
      
      if (!fs.existsSync(i18nPath)) {
        this.logger.error(`i18n.js NO encontrado en ${i18nPath}`);
        return;
      }

      let content = fs.readFileSync(i18nPath, 'utf8');

      // Helper to insert a key-value pair into a specific language block in i18n.js
      const insertInBlock = (lang: string, k: string, v: string) => {
        // Buscamos el inicio del bloque de traducción para ese idioma (ej: "es: { translation: {")
        const blockStartRegex = new RegExp(`(${lang}:\\s*{\\s*translation:\\s*{)`, 'g');
        
        // Buscamos si la clave YA existe dentro de este archivo, pero con cuidado
        // Para i18n, la clave es la misma para todos los idiomas. 
        // Queremos saber si ya está en EL BLOQUE de este lenguaje.
        
        // Estrategia: Dividimos el contenido por bloques de idiomas
        const parts = content.split(/(\w{2}:\\s*{\\s*translation:\\s*{)/g);
        let langFound = false;
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].startsWith(`${lang}:`)) {
                // El siguiente elemento (i+1) es el contenido del bloque
                if (parts[i+1] && parts[i+1].includes(`"${k}":`)) {
                    this.logger.log(`La clave "${k}" ya existe en el bloque "${lang}", omitiendo.`);
                    return;
                }
                langFound = true;
                break;
            }
        }

        const escapedValue = v.replace(/"/g, '\\"');
        const newEntry = `\n      "${k}": "${escapedValue}",`;
        content = content.replace(blockStartRegex, `$1${newEntry}`);
      };

      insertInBlock('es', key, translations.es);
      insertInBlock('en', key, translations.en);
      insertInBlock('fr', key, translations.fr);
      insertInBlock('de', key, translations.de);

      fs.writeFileSync(i18nPath, content, 'utf8');
      this.logger.log(`✅ i18n.js actualizado con éxito: "${key}"`);
    } catch (error) {
      this.logger.error('Error actualizando i18n.js:', error);
    }
  }
}
