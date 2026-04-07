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
    const results = await this.translateBatch([text]);
    return results[0]?.translations || { en: text, fr: text, de: text };
  }

  async translateBatch(texts: string[]): Promise<any[]> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    if (texts.length === 0) return [];

    const prompt = `Translate the following list of restaurant menu items/categories to English (en), French (fr), and German (de). 
    Return ONLY a JSON object with a key 'results' which is an array of objects. 
    Each object must have: 'original' (the input text), 'en', 'fr', 'de'.
    Input list: ${JSON.stringify(texts)}`;

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

      if (!response.ok) throw new Error('Groq Batch Translation failed');
      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      return parsed.results || [];
    } catch (error) {
      this.logger.error('Error in translateBatch:', error);
      return texts.map(t => ({ original: t, en: t, fr: t, de: t }));
    }
  }

  async addBatchTranslationsToFile(batch: { key: string, translations: { es: string, en: string, fr: string, de: string } }[]): Promise<void> {
    try {
      const i18nPath = path.resolve(process.cwd(), '../traeme-la-comida/src/i18n.js');
      if (!fs.existsSync(i18nPath)) {
        this.logger.error(`i18n.js NO encontrado en ${i18nPath}`);
        return;
      }

      let content = fs.readFileSync(i18nPath, 'utf8');

      for (const item of batch) {
        const { key, translations } = item;
        
        const insertInBlock = (lang: string, k: string, v: string) => {
          const blockStartRegex = new RegExp(`(${lang}:\\s*{\\s*translation:\\s*{)`, 'g');
          
          // Check if key already exists in this block
          const blockContentMatch = content.match(new RegExp(`${lang}:\\s*{\\s*translation:\\s*{([^}]*)}`, 's'));
          if (blockContentMatch && blockContentMatch[1].includes(`"${k}":`)) {
            return;
          }

          const escapedValue = v.replace(/"/g, '\\"');
          const newEntry = `\n      "${k}": "${escapedValue}",`;
          content = content.replace(blockStartRegex, `$1${newEntry}`);
        };

        insertInBlock('es', key, translations.es || key);
        insertInBlock('en', key, translations.en);
        insertInBlock('fr', key, translations.fr);
        insertInBlock('de', key, translations.de);
      }

      fs.writeFileSync(i18nPath, content, 'utf8');
      this.logger.log(`✅ i18n.js actualizado con éxito (${batch.length} entradas)`);
    } catch (error) {
      this.logger.error('Error actualizando i18n.js en batch:', error);
    }
  }

  async addTranslationsToFile(key: string, translations: { es: string, en: string, fr: string, de: string }): Promise<void> {
    return this.addBatchTranslationsToFile([{ key, translations }]);
  }
}
