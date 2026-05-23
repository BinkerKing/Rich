import { Hono } from "hono";
import { z } from "zod";
import {
  getMascotState, listMascotAnimations, playMascotAnimation,
  ANIMATIONS, type MascotAnimationName,
} from "../lib/mascotState.js";

/**
 * REST surface for the Rich mascot animation system.
 *
 *   GET  /api/mascot/state       — current animation + remaining duration
 *   GET  /api/mascot/animations  — full catalogue (UI uses to render a debug
 *                                  picker; Hermes uses MCP instead)
 *   POST /api/mascot/play        — { name, durationMs? } → state
 *
 * State changes publish `mascot.changed` on the eventBus so connected web
 * clients (HomeView) re-render via the existing /api/events SSE channel.
 */
const NameEnum = z.enum([
  "walk", "idle", "celebrate", "think", "happy", "sad",
  "alert", "sleep", "dance", "wave", "transform", "ironman",
]);

const PlaySchema = z.object({
  name: NameEnum,
  durationMs: z.number().int().min(100).max(60_000).optional(),
});

export function mascotRoutes(): Hono {
  const r = new Hono();

  r.get("/state", async (c) => {
    return c.json(getMascotState());
  });

  r.get("/animations", async (c) => {
    return c.json({ animations: listMascotAnimations() });
  });

  r.post("/play", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PlaySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid input", issues: parsed.error.issues }, 400);
    }
    const next = playMascotAnimation({
      name: parsed.data.name as MascotAnimationName,
      durationMs: parsed.data.durationMs,
      triggeredBy: "user",
    });
    return c.json(next);
  });

  return r;
}

// Side-effect free re-export so other modules can grab the catalogue
// without re-importing it from the lib path.
export { ANIMATIONS };
