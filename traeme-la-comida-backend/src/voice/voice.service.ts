import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
}
