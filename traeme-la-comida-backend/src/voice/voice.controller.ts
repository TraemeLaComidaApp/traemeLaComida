import { Controller, Post, UseInterceptors, UploadedFile, Body, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceService } from './voice.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);
  constructor(private readonly voiceService: VoiceService) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Transcribe audio file to text using Groq Whisper' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const text = await this.voiceService.transcribe(file);
      return { text };
    } catch (error) {
      throw new HttpException(error.message || 'Transcription failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('translate-menu')
  @ApiOperation({ summary: 'Translate a menu key and save it to i18n.js' })
  async translateMenu(@Body() body: { text: string; key: string }) {
    const { text, key } = body;
    if (!text || !key) {
      throw new HttpException('Text and key are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const translations = await this.voiceService.translate(text);
      // Ensure ES is the original text
      const fullTranslations = { es: text, ...translations };
      await this.voiceService.addTranslationsToFile(key, fullTranslations);
      return { success: true, translations: fullTranslations };
    } catch (error) {
       this.logger.error('Error translating menu:', error);
       throw new HttpException('Translation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
