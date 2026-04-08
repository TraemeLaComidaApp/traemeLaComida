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

  async parseOrder(transcript: string, menuContext: any): Promise<any> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const prompt = `
      Actúa como un sistema de procesamiento de pedidos para un restaurante.
      Analiza la siguiente transcripción de un pedido por voz y conviértela en un JSON estructurado.

      CONTEXTO DEL MENÚ (Productos y Opciones disponibles):
      ${JSON.stringify(menuContext)}

      TRANSCRIPCIÓN DEL CLIENTE:
      "${transcript}"

      REGLAS DE PROCESAMIENTO:
      1. Identifica todos los productos mencionados.
      2. Para cada producto, usa exactamente el 'id' del CONTEXTO DEL MENÚ.
      3. Identifica las opciones/extras seleccionados y usa sus 'id' correspondientes.
      4. Cualquier instrucción adicional (p. ej. "sin cebolla", "leche fría", "muy hecho") debe ir en el campo "notes".
      5. IMPORTANTE: Traduce siempre el campo "notes" al ESPAÑOL, independientemente del idioma original del cliente.
      6. Si la transcripción está en otro idioma (inglés, francés, alemán), identifica los productos equivalentes en el menú.
      7. Devuelve ÚNICAMENTE un objeto JSON con la clave "items", que es un array de objetos.
      8. Formato de cada item: { "productId": número, "optionIds": [números], "notes": "string en español" }

      Responde SOLO con el JSON, sin texto adicional.
    `;

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

      if (!response.ok) throw new Error('Groq Order Parsing failed');
      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      return result.items || [];
    } catch (error) {
      this.logger.error('Error in parseOrder:', error);
      throw error;
    }
  }

  async parseKitchenCommand(transcript: string, menuContext: any, activeOrders: any[]): Promise<any> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const prompt = `
      Actúa como el asistente de inteligencia artificial de la cocina de un restaurante.
      Analiza la transcripción de voz del cocinero y determina qué acción quiere realizar.

      ACCIONES POSIBLES:
      1. COMPLETE_ORDER: Cuando el cocinero dice que un pedido está listo, terminado o completado. Extrae el ID del pedido (número).
      2. OUT_OF_STOCK: Cuando el cocinero dice que no queda algo, que se ha agotado o que marquemos algo sin existencias. Identifica el ID del producto del menú.
      3. RESTOCK_PRODUCT: Cuando el cocinero dice que ya hay algo, que se ha repuesto o que lo marquemos como disponible. Identifica el ID del producto del menú.

      CONTEXTO DEL MENÚ (Identifica el ID del producto si es OUT_OF_STOCK o RESTOCK_PRODUCT):
      ${JSON.stringify(menuContext)}

      TRANSCRIPCIÓN:
      "${transcript}"

      REGLAS:
      - Responde ÚNICAMENTE con un objeto JSON.
      - Si es COMPLETE_ORDER: { "action": "COMPLETE_ORDER", "targetId": ID_DEL_PEDIDO }
      - Si es OUT_OF_STOCK: { "action": "OUT_OF_STOCK", "targetId": ID_DEL_PRODUCTO }
      - Si es RESTOCK_PRODUCT: { "action": "RESTOCK_PRODUCT", "targetId": ID_DEL_PRODUCTO }
      - Si no estás seguro o no hay un comando claro: { "action": "UNKNOWN" }
      - Para OUT_OF_STOCK o RESTOCK_PRODUCT, busca el producto en el menú y devuelve su campo 'id'.
    `;

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

      if (!response.ok) throw new Error('Groq Kitchen Parsing failed');
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      this.logger.error('Error in parseKitchenCommand:', error);
      throw error;
    }
  }

  async addTranslationsToFile(key: string, translations: { es: string, en: string, fr: string, de: string }): Promise<void> {
    return this.addBatchTranslationsToFile([{ key, translations }]);
  }
}
