// Public catalog routes — ported from src/api/index.ts's catalogApi
// (countries/services). Public read, no auth, mirrors the monolith exactly.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";

export const catalogRouter = Router();

catalogRouter.get("/countries", async (_req, res) => {
  try {
    const c = await getCollection<{
      _id: string;
      name: string;
      flag?: string;
      numbersAvailable: number;
      priceFrom: number;
      priority: number;
    }>("countries");
    const rows = await c.find({ enabled: true }).sort({ priority: 1 }).toArray();
    res.json(
      rows.map((r) => ({
        code: r._id,
        name: r.name,
        flag: r.flag ?? "",
        numbersAvailable: r.numbersAvailable,
        priceFrom: Number(r.priceFrom),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load countries" });
  }
});

catalogRouter.get("/services", async (_req, res) => {
  try {
    const c = await getCollection<{
      _id: string;
      name: string;
      icon?: string;
      category?: string;
      price: number;
      successRate: number;
    }>("services");
    const rows = await c.find({ enabled: true }).sort({ name: 1 }).toArray();
    res.json(
      rows.map((r) => ({
        id: r._id,
        name: r.name,
        icon: r.icon ?? "",
        category: r.category ?? "",
        price: Number(r.price),
        successRate: r.successRate,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load services" });
  }
});
