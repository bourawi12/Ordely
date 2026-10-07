import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { LlmService, OrderContext } from './llm.service';
import { VoiceSessionService } from './voice-session.service';
import { TtsService } from './tts.service';
import { SttService } from './stt.service';
import { segmentMultilingualText } from './language-detector';

describe('Voice Agent Backend', () => {
  describe('Language Segmentation (Code-switching)', () => {
    it('correctly segments pure French sentence', () => {
      const segments = segmentMultilingualText('Bonjour, votre commande est confirmée.');
      expect(segments.length).toBe(1);
      expect(segments[0].language).toBe('fr');
      expect(segments[0].text).toContain('Bonjour');
    });

    it('correctly segments pure Tunisian Arabic in Arabic script', () => {
      const segments = segmentMultilingualText('عسلامة، الكوموند متاعك تأكدت.');
      expect(segments.length).toBe(1);
      expect(segments[0].language).toBe('tn');
      expect(segments[0].text).toContain('عسلامة');
    });

    it('correctly segments mixed French and Tunisian Arabic', () => {
      const segments = segmentMultilingualText('Bonjour, نحب نتأكد من votre commande.');
      expect(segments.length).toBeGreaterThanOrEqual(3);
      expect(segments[0].language).toBe('fr');
      expect(segments[0].text).toContain('Bonjour');
      expect(segments[1].language).toBe('tn');
      expect(segments[1].text).toContain('نحب');
      expect(segments[2].language).toBe('fr');
      expect(segments[2].text).toContain('commande');
    });

    it('correctly segments mixed Tunisian Arabic and English', () => {
      const segments = segmentMultilingualText('عسلامة, your order is confirmed.');
      expect(segments.length).toBe(2);
      expect(segments[0].language).toBe('tn');
      expect(segments[1].language).toBe('en');
    });

    it('detects Arabizi Tunisian Derja', () => {
      const segments = segmentMultilingualText('Okay, bech nconfirmi l commande');
      const hasTn = segments.some((s) => s.language === 'tn');
      expect(hasTn).toBe(true);
    });
  });

  describe('LlmService (local fallback)', () => {
    let llm: LlmService;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LlmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(''), // No OpenAI key -> triggers local engine
            },
          },
        ],
      }).compile();

      llm = moduleRef.get(LlmService);
    });

    const mockOrder: OrderContext = {
      orderId: 42,
      customerName: 'Sami Ben Ali',
      phone: '+216 22 123 456',
      products: [{ name: 'Parfum Jasmin', quantity: 2 }],
    };

    it('generates an initial greeting with order info, segments, and UNCLEAR intent', async () => {
      const greeting = await llm.generateGreeting(mockOrder);
      expect(greeting.intent).toBe('UNCLEAR');
      expect(greeting.agentReply).toContain('Sami Ben Ali');
      expect(greeting.agentReply).toContain('Parfum Jasmin');
      expect(greeting.needsFollowUp).toBe(true);
      expect(greeting.segments).toBeDefined();
      expect(greeting.segments!.length).toBeGreaterThan(0);
    });

    it('detects French confirmation and replies in Tunisian Arabic', async () => {
      const res = await llm.processTranscript(mockOrder, [], 'Oui, je confirme');
      expect(res.intent).toBe('CONFIRMED');
      expect(res.language).toBe('TUNISIAN_ARABIC');
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
      expect(res.needsFollowUp).toBe(false);
      expect(res.segments).toBeDefined();
    });

    it('detects Tunisian Derja confirmation', async () => {
      const res = await llm.processTranscript(mockOrder, [], 'Ey mriguel ya khoya');
      expect(res.intent).toBe('CONFIRMED');
      expect(res.language).toBe('TUNISIAN_ARABIC');
      expect(res.agentReply).toContain('مريقلة');
    });

    it('detects French cancellation and replies in Tunisian Arabic', async () => {
      const res = await llm.processTranscript(mockOrder, [], 'Non je veux annuler');
      expect(res.intent).toBe('CANCELLED');
      expect(res.language).toBe('TUNISIAN_ARABIC');
      expect(res.needsFollowUp).toBe(false);
    });

    it('detects Tunisian Derja cancellation', async () => {
      const res = await llm.processTranscript(mockOrder, [], 'Le batalt');
      expect(res.intent).toBe('CANCELLED');
      expect(res.language).toBe('TUNISIAN_ARABIC');
    });

    it('handles ambiguous utterance with follow-up clarification in Tunisian Arabic', async () => {
      const res = await llm.processTranscript(mockOrder, [], 'euh je sais pas trop');
      expect(res.intent).toBe('UNCLEAR');
      expect(res.needsFollowUp).toBe(true);
      expect(res.agentReply).toContain('تحب تؤكد');
    });
  });

  describe('VoiceSessionService', () => {
    let service: VoiceSessionService;
    let llmService: LlmService;
    const prismaOrder = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    };
    const prismaCall = {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const ordersService = {
      update: jest.fn(),
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const moduleRef = await Test.createTestingModule({
        providers: [
          VoiceSessionService,
          {
            provide: PrismaService,
            useValue: {
              order: prismaOrder,
              call: prismaCall,
            },
          },
          {
            provide: OrdersService,
            useValue: ordersService,
          },
          {
            provide: LlmService,
            useValue: {
              generateGreeting: jest.fn().mockResolvedValue({
                intent: 'UNCLEAR',
                language: 'FRENCH',
                confidence: 1.0,
                needsFollowUp: true,
                agentReply: 'Bonjour Sami ! Confirmez-vous la commande #10 ?',
                segments: [{ text: 'Bonjour Sami ! Confirmez-vous la commande #10 ?', language: 'fr' }],
              }),
              processTranscript: jest.fn().mockResolvedValue({
                intent: 'CONFIRMED',
                language: 'FRENCH',
                confidence: 0.95,
                needsFollowUp: false,
                agentReply: 'Merci beaucoup !',
                segments: [{ text: 'Merci beaucoup !', language: 'fr' }],
              }),
            },
          },
          {
            provide: TtsService,
            useValue: {
              synthesizeSpeech: jest.fn().mockResolvedValue({
                audioBase64: null,
                segments: [{ text: 'test', language: 'fr' }],
              }),
            },
          },
        ],
      }).compile();

      service = moduleRef.get(VoiceSessionService);
      llmService = moduleRef.get(LlmService);
    });

    it('starts a session for a pending order and creates Call record', async () => {
      prismaOrder.findFirst.mockResolvedValue({
        id: 10,
        boutiqueId: 1,
        customer: 'Sami',
        phone: '+216 20 000 000',
        status: 'pending',
        items: [{ productName: 'Produit A', quantity: 1 }],
      });
      prismaCall.count.mockResolvedValue(0);
      prismaCall.create.mockResolvedValue({ id: 101, orderId: 10, status: 'pending' });

      const res = await service.startSession(1, 42, 10);
      expect(res.callId).toBe(101);
      expect(res.greeting.agentReply).toContain('Bonjour Sami');
      expect(prismaCall.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderId: 10, status: 'pending' }),
        }),
      );
    });

    it('rejects starting a session if order is not pending', async () => {
      prismaOrder.findFirst.mockResolvedValue({
        id: 10,
        boutiqueId: 1,
        status: 'confirmed',
        items: [],
      });

      await expect(service.startSession(1, 42, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('processes utterance and saves history', async () => {
      prismaOrder.findFirst.mockResolvedValue({
        id: 10,
        boutiqueId: 1,
        customer: 'Sami',
        phone: '+216 20 000 000',
        status: 'pending',
        items: [{ productName: 'Produit A', quantity: 1 }],
      });
      prismaCall.count.mockResolvedValue(0);
      prismaCall.create.mockResolvedValue({ id: 102, orderId: 10 });

      await service.startSession(1, 42, 10);
      const reply = await service.processUtterance(102, 1, 'Oui je confirme');

      expect(reply.intent).toBe('CONFIRMED');
      expect(llmService.processTranscript).toHaveBeenCalled();
    });

    it('completes session, updates Call record and marks order confirmed', async () => {
      prismaOrder.findFirst.mockResolvedValue({
        id: 10,
        boutiqueId: 1,
        customer: 'Sami',
        phone: '+216 20 000 000',
        status: 'pending',
        items: [{ productName: 'Produit A', quantity: 1 }],
      });
      prismaCall.count.mockResolvedValue(0);
      prismaCall.create.mockResolvedValue({ id: 103, orderId: 10 });
      prismaCall.update.mockResolvedValue({});

      await service.startSession(1, 42, 10);
      await service.processUtterance(103, 1, 'Oui je confirme');
      await service.completeSession(103, 1);

      expect(prismaCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 103 },
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
      expect(ordersService.update).toHaveBeenCalledWith(1, 10, {
        status: 'confirmed',
      });
    });
  });
});
