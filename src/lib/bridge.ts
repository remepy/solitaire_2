/**
 * Cyan game bridge (protocol v1) transport helpers.
 *
 * Game → app: CyanGameBridge.postMessage(JSON.stringify({ type, data }))
 * App → game: window.cyanBridge.receive({ type, data })
 *
 * With no bridge present (e.g. QA opening the URL in a desktop browser) every
 * post is a silent no-op and the game runs standalone (BR-09).
 */

export const GAME_ID = "solitaire";
export const PROTOCOL_VERSION = 1;

export type SessionStartData = {
  protocolVersion: number;
  sessionId: string;
  expectedLocale: string;
  levelIds: string[];
  reducedMotion: boolean;
  tutorialSeen: boolean;
};

export type AppMessage =
  | { type: "session_start"; data: SessionStartData }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "abort"; data?: { reason?: string } };

export type GameMessageType =
  | "game_ready"
  | "level_completed"
  | "game_finished"
  | "game_exit_requested"
  | "game_error";

type NativeChannel = { postMessage: (message: string) => void };

function getChannel(): NativeChannel | null {
  const channel = (globalThis as { CyanGameBridge?: NativeChannel }).CyanGameBridge;
  return channel && typeof channel.postMessage === "function" ? channel : null;
}

export function hasAppBridge(): boolean {
  return getChannel() !== null;
}

/** Messages after which the activity is over: nothing further is posted (spec §5). */
const FINAL_MESSAGES: ReadonlySet<GameMessageType> = new Set(["game_finished", "game_exit_requested", "game_error"]);
let closed = false;

/**
 * Posts one message to the app. After game_finished, game_exit_requested,
 * game_error or an app-side abort (closeBridge), every further post is dropped.
 */
export function postToApp(type: GameMessageType, data?: Record<string, unknown>): void {
  if (closed) return;
  const channel = getChannel();
  if (FINAL_MESSAGES.has(type)) closed = true;
  if (!channel) return;
  try {
    channel.postMessage(JSON.stringify(data === undefined ? { type } : { type, data }));
  } catch {
    // Nothing useful can be done if the host channel throws.
  }
}

/** Stops all further posting (used on abort). */
export function closeBridge(): void {
  closed = true;
}

export function isBridgeClosed(): boolean {
  return closed;
}

function toMessage(raw: unknown): { type?: unknown; data?: unknown } | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? (value as { type?: unknown; data?: unknown }) : null;
}

/** Defines window.cyanBridge.receive. Returns an uninstall function. */
export function installReceiver(handler: (message: { type?: unknown; data?: unknown }) => void): () => void {
  const host = globalThis as { cyanBridge?: { receive: (raw: unknown) => void } };
  const receiver = {
    receive: (raw: unknown) => {
      const message = toMessage(raw);
      if (message) handler(message);
    },
  };
  host.cyanBridge = receiver;
  return () => {
    if (host.cyanBridge === receiver) delete host.cyanBridge;
  };
}
