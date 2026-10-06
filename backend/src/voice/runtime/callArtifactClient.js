class CallArtifactClient {
  constructor({ serverUrl, token = process.env.INTERNAL_AGENT_TOKEN, fetchImpl = fetch }) {
    if (!serverUrl) throw new Error('CALL_SERVER_URL is required.');
    if (!token) throw new Error('INTERNAL_AGENT_TOKEN is required by the external agent.');
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(callId, suffix, body) {
    const response = await this.fetch(`${this.serverUrl}/api/calls/${encodeURIComponent(callId)}/${suffix}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Call artifact API failed (${response.status}): ${detail}`);
    }
    return response.json();
  }

  appendTranscript(callId, { speaker, text, timestamp = new Date().toISOString() }) {
    return this.request(callId, 'transcripts', { speaker, text, timestamp });
  }

  saveAudioAssets(callId, assets) {
    return this.request(callId, 'assets', { assets });
  }
}

module.exports = { CallArtifactClient };