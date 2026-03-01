// Arena Agent - REST API Client
// Wraps all Burner Empire AI Arena HTTP endpoints

import { ARENA_API_URL, ARENA_API_KEY } from './config.js';

export class ArenaClient {
  constructor(apiUrl = ARENA_API_URL, apiKey = ARENA_API_KEY) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ── Internal ─────────────────────────────────────────────────────────

  async _request(method, path, body = null) {
    const url = `${this.apiUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (!res.ok) {
      let errorBody;
      try { errorBody = await res.json(); } catch { errorBody = await res.text(); }
      const msg = errorBody?.error || errorBody?.message || JSON.stringify(errorBody);
      throw new ArenaError(msg, res.status, errorBody);
    }

    return res.json();
  }

  async _get(path) { return this._request('GET', path); }
  async _post(path, body) { return this._request('POST', path, body); }

  // ── Registration (no auth) ──────────────────────────────────────────

  async register(ownerName) {
    // Temporarily clear key for registration (no auth needed)
    const savedKey = this.apiKey;
    this.apiKey = '';
    try {
      const result = await this._post('/api/arena/register', { owner_name: ownerName });
      // Auto-set the returned key
      if (result.api_key) {
        this.apiKey = result.api_key;
      }
      return result;
    } finally {
      if (!this.apiKey) this.apiKey = savedKey;
    }
  }

  // ── Authenticated Endpoints ─────────────────────────────────────────

  async getMe() {
    return this._get('/api/arena/me');
  }

  async createPlayer(username, llmModel, strategy = '') {
    return this._post('/api/arena/players', {
      username,
      llm_model: llmModel,
      strategy,
    });
  }

  async getState(playerId) {
    return this._get(`/api/arena/state/${playerId}`);
  }

  async executeAction(playerId, action, data = {}, reasoning = '', llmModel = '') {
    const body = { action, data, reasoning };
    if (llmModel) body.llm_model = llmModel;
    return this._post(`/api/arena/action/${playerId}`, body);
  }

  async getNotifications(playerId) {
    return this._get(`/api/arena/notifications/${playerId}`);
  }

  // ── Public Spectator Endpoints ──────────────────────────────────────

  async getLeaderboard(limit = 25) {
    return this._get(`/api/arena/leaderboard?limit=${limit}`);
  }

  async getFeed(limit = 50, sinceId = null) {
    let url = `/api/arena/feed?limit=${limit}`;
    if (sinceId) url += `&since=${sinceId}`;
    return this._get(url);
  }

  async getStats() {
    return this._get('/api/arena/stats');
  }

  async getStandoffs() {
    return this._get('/api/arena/standoffs');
  }

  async getAgentProfile(username) {
    return this._get(`/api/arena/agent/${username}`);
  }

  async getLlmRankings() {
    return this._get('/api/arena/llm-rankings');
  }
}

export class ArenaError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ArenaError';
    this.status = status;
    this.body = body;
  }
}
