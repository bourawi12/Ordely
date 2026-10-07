import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import { SttResult } from './voice.interfaces';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY', '').trim();
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.get<string>('OPENAI_BASE_URL') || undefined,
      });
      this.logger.log('SttService initialized with OpenAI Whisper');
    } else {
      this.logger.warn('OPENAI_API_KEY not set for Whisper STT. Local audio fallback active.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  /**
   * Transcribe an audio buffer (WebM / WAV / MP3 / OGG) to text.
   * Leverages OpenAI Whisper with vocabulary biasing for French, Arabic, Derja, and English.
   */
  async transcribe(
    audioBuffer: Buffer,
    mimeType = 'audio/webm',
  ): Promise<SttResult> {
    this.logger.log(`[VOICE_DEBUG] STT_STARTED: received ${audioBuffer.length} bytes, format: ${mimeType}`);

    if (!audioBuffer || audioBuffer.length === 0) {
      this.logger.warn('[VOICE_DEBUG] STT_ERROR: empty audio buffer received');
      return { text: '', confidence: 0 };
    }

    if (!this.client) {
      this.logger.warn(
        '[VOICE_DEBUG] STT_ERROR: OpenAI Whisper not configured (missing OPENAI_API_KEY).',
      );
      return {
        text: '',
        confidence: 0,
      };
    }

    try {
      const extension = mimeType.includes('wav') ? 'wav' : 'webm';
      const file = await toFile(audioBuffer, `speech.${extension}`, { type: mimeType });

      // Bias Whisper's vocabulary towards Tunisian dialect, French, and English code-switching
      const transcription = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        prompt:
          "Ordely, Bonjour, عسلامة، نحب نأكد الكوموند، oui je confirme, non annulez, behi, mriguel, cancel, order, bech nconfirmi, y3aychek",
      });

      const text = transcription.text.trim();
      this.logger.log(`[VOICE_DEBUG] STT_FINAL_TRANSCRIPT: "${text}"`);
      return {
        text,
        confidence: 0.95,
      };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`[VOICE_DEBUG] STT_ERROR: ${msg}`);
      throw err;
    }
  }
}
