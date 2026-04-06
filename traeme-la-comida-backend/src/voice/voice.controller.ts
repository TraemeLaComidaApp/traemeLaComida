import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceService } from './voice.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
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
}
