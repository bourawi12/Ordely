import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CallArtifactService } from './call-artifact.service';

describe('CallArtifactService', () => {
  let service: CallArtifactService;
  let prismaMock: {
    call: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    callTranscriptEntry: {
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
    callRecording: {
      upsert: jest.Mock;
    };
  };
  let storageMock: {
    put: jest.Mock;
    url: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      call: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      callTranscriptEntry: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      callRecording: {
        upsert: jest.fn(),
      },
    };
    storageMock = {
      put: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockResolvedValue('https://signed-url.example/test.wav'),
    };

    service = new CallArtifactService(
      prismaMock as unknown as PrismaService,
      storageMock as unknown as StorageService,
    );
  });

  it('saves a transcript entry and updates the call legacy transcript array', async () => {
    prismaMock.call.findUnique.mockResolvedValue({ id: 101 });
    prismaMock.callTranscriptEntry.upsert.mockResolvedValue({ id: 1 });
    prismaMock.callTranscriptEntry.findMany.mockResolvedValue([
      { speaker: 'agent', text: 'Asslema' },
    ]);
    prismaMock.call.update.mockResolvedValue({ id: 101 });

    await service.saveTranscript({
      taskId: 'task-123',
      sequence: 1,
      speaker: 'agent',
      text: 'Asslema',
      timestamp: new Date().toISOString(),
    });

    expect(prismaMock.callTranscriptEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          callId_sequence: {
            callId: 101,
            sequence: 1,
          },
        },
      }),
    );

    expect(prismaMock.call.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        transcript: [{ speaker: 'agent', text: 'Asslema' }],
      },
    });
  });

  it('saves an audio recording to MinIO and upserts a CallRecording row', async () => {
    prismaMock.call.findUnique.mockResolvedValue({
      id: 101,
      order: { boutiqueId: 5 },
    });
    prismaMock.callRecording.upsert.mockResolvedValue({
      id: 1,
      objectKey: 'calls/5/101/agent.wav',
    });

    const buffer = Buffer.from('RIFF mock wav');
    const result = await service.saveRecording(
      'task-123',
      'agent',
      buffer,
      5000,
    );

    expect(storageMock.put).toHaveBeenCalledWith(
      'calls/5/101/agent.wav',
      buffer,
      'audio/wav',
    );

    expect(prismaMock.callRecording.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          callId_speaker: {
            callId: 101,
            speaker: 'agent',
          },
        },
      }),
    );
    expect(result.objectKey).toBe('calls/5/101/agent.wav');
  });

  it('generates a presigned URL when recording exists for boutique', async () => {
    prismaMock.call.findFirst.mockResolvedValue({
      id: 101,
      order: { boutiqueId: 5 },
      recordings: [{ speaker: 'agent', objectKey: 'calls/5/101/agent.wav' }],
    });

    const url = await service.getRecordingUrl(5, 101, 'agent');

    expect(storageMock.url).toHaveBeenCalledWith('calls/5/101/agent.wav');
    expect(url).toBe('https://signed-url.example/test.wav');
  });

  it('throws NotFoundException when recording is missing or not owned by boutique', async () => {
    prismaMock.call.findFirst.mockResolvedValue(null);

    await expect(service.getRecordingUrl(5, 101, 'mobile')).rejects.toThrow(
      NotFoundException,
    );
  });
});
