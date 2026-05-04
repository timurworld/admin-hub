// Bot driver — runs in the EmoneyAdmin tab while it's open. Spawns fake
// "live" players that fully imitate real player behavior:
//   • Presence: appear in the live count
//   • Score growth: tick lifetime_points on a per-bot interval (with bursts)
//   • Ambient emotes: 🔥/❤️/😂 chatter every 40-120s
//   • Reactive emotes: respond to admin events (broadcasts, votes, effects, gifts)
//   • Vote auto-yes: 80% yes bias on any new poll, random delay 1-5s
//   • Drop event participation: roll for items when a drop is live
//   • Locker fusion: fuse when they have all ingredients
//
// Lifted from scripts/testbots.js (game repo) and extended with drop+locker
// participation. State lives in module scope so a React component remount
// doesn't drop the running bots — they keep going until Stop all or tab close.

import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eztmcfghqeheiamhyner.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dG1jZmdocWVoZWlhbWh5bmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDU2MzksImV4cCI6MjA5MTYyMTYzOX0.pVfomYODplqr_AI2hNYqyVp0oYx_2EHdutzxAj15XHg";
const GAME_ID = "brainrot";

// 70-bot roster. First 36 are the original cast (already seeded in DB);
// the next 34 are added for higher-headcount demos and auto-register on
// first spawn (see Bot.loadCreds). All bots use PIN "0000" by convention.
const ALL_BOTS = [
  // ----- Original 36 (seeded) -----
  "FanumKid", "TuahKing", "RizzMaster", "OhioMain", "SigmaBoy", "BrainBoss", "SkibidiChad",
  "ToiletSkibidi", "RizzGodKing", "SigmaBossX",
  "ProGamer42", "zombiekid77", "NoobSlay3r", "PixelKnight", "SnipeKid44", "xX_Sn1per_Xx",
  "NinjaPanda", "JellyMonster", "FrostyKnight", "PinkDragon", "SpicyTurtle", "PeachStorm",
  "MintyFresh",
  "CrispyBacon", "ToastedKing", "MrCheese", "CoolBeans99", "BananaPhone", "SunnyKid23",
  "ToadKnight7", "LemonSlice99",
  "Waves07", "CloudHopper9", "BlocxyKing", "RoboBlast",
  "PixelSquid",
  // ----- Extension 37-70 (auto-registered on first spawn) -----
  "GyattLord", "OhioRizz", "GooningChad", "MewingKing", "DripGodX", "SkibidiTuah",
  "BuffMewer", "SigmaSlam",
  "BlocxyBuilder", "AdoptMeAce", "BedwarsPro22", "ArsenalSnipe", "NoobZoneXX",
  "StealthyCheetah", "MoodyMonkey", "ZenSloth", "ThunderDolphin", "GalaxyWolf",
  "JadeFox", "RubberDucky9",
  "TacoSlayer", "NachoSenor", "PancakeMon", "WaffleSlurp", "KetchupKing", "WatermelonWiz",
  "DJDanger99", "RedFoxRunner", "BlueBoltBoy", "NeonGhost", "SlippySocks",
  "CosmicWaffles", "NightOwlNick", "ProtonFizz",
  // ----- Extension 71-82 (also auto-registered on first spawn) -----
  "PixelPanic", "SkibidiMaxer", "RizzVortex", "GyattZilla", "GoonFather9",
  "ChugJugBoss", "WaffleStomper", "CrowdSurfer", "SlayKing77", "NeonNinjaXX",
  "ShadowSlime", "CrumbleCake",
];
const BOT_PIN = "0000";

const TICK_MIN = 80;
const TICK_MAX = 450;
const YES_BIAS = 0.8;
const AMBIENT_POOL = ["🔥", "❤️", "😂", "💀", "🎉", "🧠", "✨", "👀", "🚀"];
const SKIN_POOL = [3, 4, 5, 9, 11, 15, 18];
const EMOTE_REACT_CHANCE = 0.55;

interface BotCreds { player_id: string; pin: string }

// ----- Coordinator: one shared client watching global game state ------------
// 36 bots × N tables would mean a few hundred WebSocket subscriptions if we
// gave every bot its own realtime channels. The coordinator instead holds one
// channel set, parses payloads, and notifies each bot via in-memory listeners.

interface CoordinatorState {
  activeDropEvent: { id: string } | null;
  activeLocker: { id: string; recipe: { skin_id: number; qty: number }[]; output_skin_id: number } | null;
  // Hard ceiling on bot lifetime_points so bots never overtake the real top 5.
  // Refreshed periodically — null while initial fetch is pending (bots skip
  // ticks during that brief window to be safe).
  topFiveCutoff: number | null;
}

type Listener = (e: CoordEvent) => void;
type CoordEvent =
  | { kind: "vote-started"; voteId: string; question: string }
  | { kind: "reactive-emote"; pool: string[] };

class Coordinator {
  private client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private cutoffInterval: ReturnType<typeof setInterval> | null = null;
  state: CoordinatorState = { activeDropEvent: null, activeLocker: null, topFiveCutoff: null };
  private listeners = new Set<Listener>();

  private async refreshTopFiveCutoff() {
    const { data } = await this.client.from("leaderboard")
      .select("lifetime_points")
      .order("lifetime_points", { ascending: false })
      .limit(5);
    if (data && data.length >= 5) {
      // Bots must stay strictly below 5th place. We cap with a 1% safety
      // margin so a fluctuating 5th can't push a bot momentarily above.
      this.state.topFiveCutoff = Math.floor(data[4].lifetime_points * 0.99);
    }
  }

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  on(cb: Listener) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  private emit(e: CoordEvent) { this.listeners.forEach((l) => l(e)); }

  async start() {
    if (this.channel) return;

    // Initial state: any active drop / locker right now
    const { data: drop } = await this.client.from("drop_events")
      .select("id").eq("game_id", GAME_ID).eq("status", "active").maybeSingle();
    if (drop) this.state.activeDropEvent = { id: drop.id };

    const { data: locker } = await this.client.from("lockers")
      .select("id, recipe, output_skin_id").eq("game_id", GAME_ID).eq("status", "active").maybeSingle();
    if (locker) this.state.activeLocker = locker as CoordinatorState["activeLocker"];

    await this.refreshTopFiveCutoff();
    this.cutoffInterval = setInterval(() => { this.refreshTopFiveCutoff().catch(() => {}); }, 60_000);

    this.channel = this.client.channel("bot-coordinator")
      .on("postgres_changes", { event: "*", schema: "public", table: "drop_events" }, (p) => {
        const r = p.new as { id?: string; status?: string };
        if (r?.status === "active") this.state.activeDropEvent = { id: r.id! };
        else if (this.state.activeDropEvent?.id === r?.id) this.state.activeDropEvent = null;
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lockers" }, (p) => {
        const r = p.new as { id?: string; status?: string; recipe?: unknown; output_skin_id?: number };
        if (r?.status === "active") {
          this.state.activeLocker = {
            id: r.id!,
            recipe: (r.recipe as { skin_id: number; qty: number }[]) || [],
            output_skin_id: r.output_skin_id!,
          };
        } else if (this.state.activeLocker?.id === r?.id) {
          this.state.activeLocker = null;
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "active_votes" }, (p) => {
        const r = p.new as { id?: string; question?: string; active?: boolean };
        if (r?.active && r.id) this.emit({ kind: "vote-started", voteId: r.id, question: r.question || "" });
        this.emit({ kind: "reactive-emote", pool: ["🧠", "🔥", "💀"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_messages" }, () => {
        this.emit({ kind: "reactive-emote", pool: ["😂", "🧠", "🔥", "❤️"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "active_effects" }, (p) => {
        const r = p.new as { active?: boolean };
        if (r?.active) this.emit({ kind: "reactive-emote", pool: ["🎉", "🔥", "❤️", "💀"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "coin_gifts" }, () => {
        this.emit({ kind: "reactive-emote", pool: ["❤️", "🎉", "🔥"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "skin_gifts" }, () => {
        this.emit({ kind: "reactive-emote", pool: ["🎉", "❤️", "🔥"] });
      })
      .subscribe();
  }

  async stop() {
    if (this.channel) {
      await this.client.removeChannel(this.channel).catch(() => {});
      this.channel = null;
    }
    if (this.cutoffInterval) {
      clearInterval(this.cutoffInterval);
      this.cutoffInterval = null;
    }
  }
}

const coordinator = new Coordinator();

// ----- Bot --------------------------------------------------------------------

class Bot {
  name: string;
  key: string;
  client: SupabaseClient;
  presence: RealtimeChannel | null = null;
  emoteChannel: RealtimeChannel | null = null;
  presenceKeepalive: ReturnType<typeof setInterval> | null = null;
  tickTimer: ReturnType<typeof setInterval> | null = null;
  ambientTimer: ReturnType<typeof setTimeout> | null = null;
  dropRollTimer: ReturnType<typeof setTimeout> | null = null;
  lockerCheckTimer: ReturnType<typeof setTimeout> | null = null;
  unsubCoord: (() => void) | null = null;
  isLive = false;
  creds: BotCreds | null = null;

  constructor(name: string) {
    this.name = name;
    this.key = name.toLowerCase();
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Load player_id + pin once per bot. Self-bootstraps: if no row exists,
  // inserts one with the standard bot PIN "0000" and creates the matching
  // leaderboard entry. This is what lets the extended roster (37-70) work
  // on first spawn without a separate seed migration.
  private async loadCreds(): Promise<BotCreds | null> {
    if (this.creds) return this.creds;
    const { data } = await this.client.from("players")
      .select("id, pin").ilike("username", this.name).maybeSingle();
    if (data?.id && data?.pin) {
      this.creds = { player_id: data.id, pin: data.pin };
      return this.creds;
    }
    // Auto-register
    const { data: created } = await this.client.from("players")
      .insert({ username: this.key, pin: BOT_PIN })
      .select("id, pin").maybeSingle();
    if (!created?.id) return null;
    await this.client.from("leaderboard")
      .insert({ player_id: created.id, username: this.key })
      .then(() => {});
    this.creds = { player_id: created.id, pin: created.pin };
    return this.creds;
  }

  private fireEmote(pool: string[]) {
    if (!this.isLive || !this.emoteChannel) return;
    if (Math.random() > EMOTE_REACT_CHANCE) return;
    const delay = 400 + Math.random() * 3100;
    setTimeout(async () => {
      if (!this.isLive) return;
      const emote = pool[Math.floor(Math.random() * pool.length)];
      try {
        await this.emoteChannel?.send({
          type: "broadcast", event: "emote",
          payload: { username: this.name, emote },
        });
      } catch {}
    }, delay);
  }

  // 80% yes vote, random delay so the count doesn't all jump at once.
  private async voteOnPoll(voteId: string) {
    if (!this.isLive) return;
    const choice = Math.random() < YES_BIAS ? "yes_count" : "no_count";
    const delay = 1000 + Math.random() * 4000;
    setTimeout(async () => {
      if (!this.isLive) return;
      const { data: cur } = await this.client.from("active_votes")
        .select(choice).eq("id", voteId).single();
      if (!cur) return;
      const curVal = (cur as Record<string, number>)[choice] || 0;
      await this.client.from("active_votes")
        .update({ [choice]: curVal + 1 })
        .eq("id", voteId);
    }, delay);
  }

  // Roll for drops on a 1-3s cadence while a drop event is active — mimics
  // a real player tapping rapidly. Bots are the engine that makes drop pools
  // actually deplete during a live event; at the previous 5-15s cadence the
  // 70 bots couldn't keep up with even moderate drop rates.
  private scheduleDropRoll() {
    if (!this.isLive) return;
    const delay = 1_000 + Math.random() * 2_000;
    this.dropRollTimer = setTimeout(async () => {
      if (!this.isLive) return;
      const drop = coordinator.state.activeDropEvent;
      const creds = this.creds;
      if (drop && creds) {
        try {
          await this.client.rpc("drop_roll", {
            p_player_id: creds.player_id,
            p_pin: creds.pin,
            p_event_id: drop.id,
          });
        } catch {}
      }
      this.scheduleDropRoll();
    }, delay);
  }

  // Check if we have all ingredients for the active locker. If yes, fuse.
  // Server enforces 1-per-player cap, so re-firing is harmless.
  private scheduleLockerCheck() {
    if (!this.isLive) return;
    // Stagger across bots so the fuse rush isn't synchronized.
    const delay = 30_000 + Math.random() * 30_000;
    this.lockerCheckTimer = setTimeout(async () => {
      if (!this.isLive) return;
      const locker = coordinator.state.activeLocker;
      const creds = this.creds;
      if (locker && creds) {
        // Check inventory has all ingredients
        const { data: inv } = await this.client.from("inventory")
          .select("skin_id, quantity").eq("player_id", creds.player_id);
        const counts: Record<number, number> = {};
        (inv || []).forEach((r: { skin_id: number; quantity: number }) => {
          counts[r.skin_id] = (counts[r.skin_id] || 0) + (r.quantity || 0);
        });
        const hasAll = locker.recipe.every((ing) => (counts[ing.skin_id] || 0) >= ing.qty);
        if (hasAll) {
          try {
            await this.client.rpc("locker_fuse", {
              p_player_id: creds.player_id,
              p_pin: creds.pin,
              p_locker_id: locker.id,
            });
          } catch {}
        }
      }
      this.scheduleLockerCheck();
    }, delay);
  }

  async goLive() {
    if (this.isLive) return;
    this.isLive = true;

    await this.loadCreds();

    // Presence
    this.presence = this.client.channel("brainrot:presence", { config: { presence: { key: this.key } } });
    this.presence.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await this.presence?.track({ username: this.key, online_at: new Date().toISOString() });
      }
    });
    this.presenceKeepalive = setInterval(() => {
      this.presence?.track({ username: this.key, online_at: new Date().toISOString() }).catch(() => {});
    }, 30_000);

    // Tick points
    const personalTickMs = 3000 + Math.random() * 6000;
    let burstUntil = 0;
    this.tickTimer = setInterval(async () => {
      const inBurst = Date.now() < burstUntil;
      if (!inBurst && Math.random() < 1 / 12) burstUntil = Date.now() + 30_000;
      const { data: row } = await this.client.from("leaderboard")
        .select("player_id, lifetime_points")
        .ilike("username", this.name).maybeSingle();
      if (!row) return;
      // Top-5 protection — never overtake the 5th-place real player.
      const cutoff = coordinator.state.topFiveCutoff;
      const current = row.lifetime_points || 0;
      if (cutoff !== null && current >= cutoff) return; // already at the ceiling, freeze
      let gain = TICK_MIN + Math.floor(Math.random() * (TICK_MAX - TICK_MIN));
      if (inBurst) gain *= 5;
      const next = cutoff !== null ? Math.min(current + gain, cutoff) : current + gain;
      if (next === current) return;
      await this.client.from("leaderboard")
        .update({ lifetime_points: next })
        .eq("player_id", row.player_id);
    }, personalTickMs);

    // Random equipped skin
    const pickedSkin = SKIN_POOL[Math.floor(Math.random() * SKIN_POOL.length)];
    this.client.from("leaderboard")
      .update({ equipped_skin: pickedSkin })
      .ilike("username", this.name).then(() => {});

    // Emote channel — both ambient and reactive flow through here
    this.emoteChannel = this.client.channel("brainrot:emotes");
    this.emoteChannel.subscribe();

    const scheduleAmbient = () => {
      if (!this.isLive) return;
      const delay = 40_000 + Math.random() * 80_000;
      this.ambientTimer = setTimeout(async () => {
        if (!this.isLive) return;
        const emote = AMBIENT_POOL[Math.floor(Math.random() * AMBIENT_POOL.length)];
        try {
          await this.emoteChannel?.send({
            type: "broadcast", event: "emote",
            payload: { username: this.name, emote },
          });
        } catch {}
        scheduleAmbient();
      }, delay);
    };
    scheduleAmbient();

    // Coordinator events: reactive emotes + vote auto-yes
    this.unsubCoord = coordinator.on((e) => {
      if (e.kind === "reactive-emote") this.fireEmote(e.pool);
      else if (e.kind === "vote-started") this.voteOnPoll(e.voteId);
    });

    this.scheduleDropRoll();
    this.scheduleLockerCheck();
  }

  async goOffline() {
    if (!this.isLive) return;
    this.isLive = false;
    if (this.presenceKeepalive) { clearInterval(this.presenceKeepalive); this.presenceKeepalive = null; }
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.ambientTimer) { clearTimeout(this.ambientTimer); this.ambientTimer = null; }
    if (this.dropRollTimer) { clearTimeout(this.dropRollTimer); this.dropRollTimer = null; }
    if (this.lockerCheckTimer) { clearTimeout(this.lockerCheckTimer); this.lockerCheckTimer = null; }
    if (this.unsubCoord) { this.unsubCoord(); this.unsubCoord = null; }
    if (this.emoteChannel) {
      await this.client.removeChannel(this.emoteChannel).catch(() => {});
      this.emoteChannel = null;
    }
    if (this.presence) {
      await this.presence.untrack().catch(() => {});
      await this.client.removeChannel(this.presence).catch(() => {});
      this.presence = null;
    }
  }
}

// ----- Module-level state -----------------------------------------------------

const bots: Bot[] = ALL_BOTS.map((n) => new Bot(n));
const subscribers = new Set<() => void>();
function notify() { subscribers.forEach((cb) => cb()); }

export const ROSTER_SIZE = ALL_BOTS.length;
export function getLiveCount(): number { return bots.filter((b) => b.isLive).length; }
export function getLiveNames(): string[] { return bots.filter((b) => b.isLive).map((b) => b.name); }
export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

// Bring up the next `count` offline bots in roster order. Starts the
// coordinator on first spawn so reactive features wire up.
export async function spawnBots(count: number): Promise<number> {
  await coordinator.start();
  const offline = bots.filter((b) => !b.isLive).slice(0, count);
  await Promise.all(offline.map((b) => b.goLive()));
  notify();
  return offline.length;
}

export async function stopAll(): Promise<void> {
  await Promise.all(bots.map((b) => b.goOffline()));
  await coordinator.stop();
  notify();
}
