import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { segmentMultilingualText } from './language-detector';
import { SpeechSegment } from './voice.interfaces';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly client: OpenAI | null = null;
  private readonly defaultVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY', '').trim();
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.get<string>('OPENAI_BASE_URL') || undefined,
      });
      this.logger.log('TtsService initialized with OpenAI Neural TTS');
    } else {
      this.logger.warn('OPENAI_API_KEY not set for Neural TTS. Client-side segment synthesis active.');
    }
    this.defaultVoice = (config.get<string>('OPENAI_TTS_VOICE', 'alloy') as any) || 'alloy';
  }

  /**
   * Segments text into language-coherent chunks for code-switched synthesis.
   */
  segmentText(text: string): SpeechSegment[] {
    return segmentMultilingualText(text);
  }

  /**
   * Generates natural speech for the text.
   * If OpenAI TTS is configured, returns high-fidelity base64 MP3 audio that
   * naturally handles code-switching in a single human voice.
   * If not configured or if the request fails, returns null so the client falls
   * back smoothly to the segmented Web Speech API player.
   */
  async synthesizeSpeech(
    text: string,
    voiceOverride?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
  ): Promise<{ audioBase64: string | null; segments: SpeechSegment[] }> {
    const segments = this.segmentText(text);

    if (!this.client || !text.trim()) {
      return { audioBase64: null, segments };
    }

    try {
      this.logger.log(`[VOICE_DEBUG] TTS_STARTED: synthesizing "${text.slice(0, 60)}..."`);
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: voiceOverride || this.defaultVoice,
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      const audioBase64 = buffer.toString('base64');
      this.logger.log(`[VOICE_DEBUG] TTS_SUCCESS: generated ${buffer.length} bytes MP3`);

      return { audioBase64, segments };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`[VOICE_DEBUG] TTS_ERROR: ${msg}. Falling back to client-side segment synthesis.`);
      return { audioBase64: null, segments };
    }
  }
}
