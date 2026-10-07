import { VoiceController } from './voice.controller';

describe('VoiceController', () => {
  let controller: VoiceController;
  let artifactService: {
    listTranscripts: jest.Mock;
    saveTranscript: jest.Mock;
    listAssets: jest.Mock;
    saveRecording: jest.Mock;
  };
  let voiceAgentClient: {
    startTask: jest.Mock;
    stopTask: jest.Mock;
    healthCheck: jest.Mock;
  };

  beforeEach(() => {
    artifactService = {
      listTranscripts: jest.fn(),
      saveTranscript: jest.fn(),
      listAssets: jest.fn(),
      saveRecording: jest.fn(),
    };
    voiceAgentClient = {
      startTask: jest.fn(),
      stopTask: jest.fn(),
      healthCheck: jest.fn(),
    };

    controller = new VoiceController(
      artifactService as any,
      voiceAgentClient as any,
    );
  });

  it('lists transcripts for a boutique call', async () => {
    const payload = [{ id: 1, callId: 12, sequence: 1, speaker: 'agent', text: 'salut', timestamp: '2026-01-01T00:00:00.000Z' }];
    artifactService.listTranscripts.mockResolvedValue(payload);

    await expect(controller.listTranscripts(1, 12)).resolves.toEqual(payload);
    expect(artifactService.listTranscripts).toHaveBeenCalledWith(1, 12);
  });

  it('stores a transcript payload', async () => {
    const payload = { callId: 12, sequence: 1, speaker: 'agent', text: 'salut', timestamp: '2026-01-01T00:00:00.000Z' };
    artifactService.saveTranscript.mockResolvedValue({ ...payload, id: 1 });

    await expect(controller.saveTranscript(1, 12, payload as any)).resolves.toEqual({ ...payload, id: 1 });
    expect(artifactService.saveTranscript).toHaveBeenCalledWith(1, 12, payload);
  });

  it('lists per-speaker assets for a boutique call', async () => {
    const payload = [{ id: 1, speaker: 'agent', objectKey: 'calls/1/12/agent.wav' }];
    artifactService.listAssets.mockResolvedValue(payload);

    await expect(controller.listAssets(1, 12)).resolves.toEqual(payload);
    expect(artifactService.listAssets).toHaveBeenCalledWith(1, 12);
  });

  it('starts a voice task through the provider adapter', async () => {
    const task = { taskId: 'task-123', destination: '+15551234567' };
    voiceAgentClient.startTask.mockResolvedValue({ ok: true, taskId: task.taskId });

    await expect(controller.startTask(task as any)).resolves.toEqual({
      ok: true,
      taskId: 'task-123',
    });
    expect(voiceAgentClient.startTask).toHaveBeenCalledWith(task);
  });

  it('reports health via the provider adapter', async () => {
    voiceAgentClient.healthCheck.mockResolvedValue(true);

    await expect(controller.healthCheck()).resolves.toEqual({ ok: true });
    expect(voiceAgentClient.healthCheck).toHaveBeenCalled();
  });
});
