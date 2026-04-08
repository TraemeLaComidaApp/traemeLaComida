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

  @Post('translate-batch')
  @ApiOperation({ summary: 'Translate multiple menu keys and save them to i18n.js in a single batch' })
  async translateMenuBatch(@Body() body: { items: { text: string; key: string }[] }) {
    const { items } = body;
    if (!items || !Array.isArray(items)) {
      throw new HttpException('Items array is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const texts = items.map(i => i.text);
      const translatedResults = await this.voiceService.translateBatch(texts);
      
      const batchToSave = items.map((item, index) => {
        const trans = translatedResults.find(r => r.original === item.text) || { en: item.text, fr: item.text, de: item.text };
        return {
          key: item.key,
          translations: { es: item.text, ...trans }
        };
      });

      await this.voiceService.addBatchTranslationsToFile(batchToSave);
      return { success: true, processed: batchToSave.length };
    } catch (error) {
      this.logger.error('Error in batch translation:', error);
      throw new HttpException('Batch translation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('parse-order')
  @ApiOperation({ summary: 'Parse a voice transcript into a structured order' })
  async parseOrder(@Body() body: { transcript: string; menuContext: any }) {
    const { transcript, menuContext } = body;
    if (!transcript || !menuContext) {
      throw new HttpException('Transcript and menuContext are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const items = await this.voiceService.parseOrder(transcript, menuContext);
      return { items };
    } catch (error) {
       this.logger.error('Error parsing order:', error);
       throw new HttpException('Order parsing failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
