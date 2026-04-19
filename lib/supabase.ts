import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eztmcfghqeheiamhyner.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dG1jZmdocWVoZWlhbWh5bmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDU2MzksImV4cCI6MjA5MTYyMTYzOX0.pVfomYODplqr_AI2hNYqyVp0oYx_2EHdutzxAj15XHg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export const GAME_ID = "brainrot";

export const EFFECTS = [
  { id: "disco", emoji: "🪩", name: "Disco Ball Drop", color: "#ff79ff" },
  { id: "fireworks", emoji: "🎆", name: "Fireworks Show", color: "#ffcc33" },
  { id: "poop", emoji: "💩", name: "Poop Storm", color: "#8b5a2b" },
  { id: "rocket", emoji: "🚀", name: "Rocket Launch", color: "#ff6b00" },
  { id: "cats", emoji: "🐱", name: "Cat Rave", color: "#ff69b4" },
  { id: "tsunami", emoji: "🌊", name: "Coin Tsunami", color: "#00d4ff" },
  { id: "lightning", emoji: "⚡", name: "Lightning Rage", color: "#ffe23d" },
  { id: "bomb", emoji: "💣", name: "Brainrot Bomb", color: "#ff4a4a" },
  { id: "crowd", emoji: "🎤", name: "Crowd Goes Wild", color: "#00e87a" },
];
