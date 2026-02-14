type StoredChatMessage = {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
};

type StoredChatMemory = {
  messages: StoredChatMessage[];
  lastIntent?: string;
  lastActionPlan?: string;
  updatedAt: number;
};

const STORAGE_KEY = 'autoquote_chat_memory_v1';
const MAX_MESSAGES = 30;

const normalizeSessionId = (sessionId?: string) => {
  const normalized = toSafeString(sessionId);
  return normalized || 'global';
};

const getStorageKey = (sessionId?: string) => `${STORAGE_KEY}:${normalizeSessionId(sessionId)}`;

const toSafeString = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const loadChatMemory = (sessionId?: string): StoredChatMemory | null => {
  try {
    const raw = localStorage.getItem(getStorageKey(sessionId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const messages = Array.isArray(parsed?.messages)
      ? parsed.messages
          .filter((msg: any) => (msg?.role === 'user' || msg?.role === 'model') && typeof msg?.text === 'string')
          .map((msg: any) => ({
            role: msg.role,
            text: toSafeString(msg.text),
            timestamp: Number(msg.timestamp) || Date.now(),
          }))
          .filter((msg: StoredChatMessage) => msg.text.length > 0)
      : [];

    return {
      messages,
      lastIntent: toSafeString(parsed?.lastIntent) || undefined,
      lastActionPlan: toSafeString(parsed?.lastActionPlan) || undefined,
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
};

export const saveChatMemory = (memory: {
  messages: Array<{ role: 'user' | 'model'; text: string }>;
  lastIntent?: string;
  lastActionPlan?: string;
}, sessionId?: string) => {
  const normalizedMessages = memory.messages
    .map((msg) => ({
      role: msg.role,
      text: toSafeString(msg.text),
      timestamp: Date.now(),
    }))
    .filter((msg) => msg.text.length > 0)
    .slice(-MAX_MESSAGES);

  const payload: StoredChatMemory = {
    messages: normalizedMessages,
    lastIntent: toSafeString(memory.lastIntent) || undefined,
    lastActionPlan: toSafeString(memory.lastActionPlan) || undefined,
    updatedAt: Date.now(),
  };

  localStorage.setItem(getStorageKey(sessionId), JSON.stringify(payload));
};

export const clearChatMemory = (sessionId?: string) => {
  localStorage.removeItem(getStorageKey(sessionId));
};
