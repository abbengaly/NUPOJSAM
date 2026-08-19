import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  CreateAgentBody,
  CreateHoursEntryBody,
  CreateScheduleEntryBody,
  GetDashboardResponse,
  ListAgentsResponse,
  ListHoursResponse,
  ListScheduleQueryParams,
  ListScheduleResponse,
  UpdateAgentBody,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { agentsTable, hoursTable, scheduleTable } from "@workspace/db/schema";

const router: IRouter = Router();

const toAgent = (row: typeof agentsTable.$inferSelect) => ({
  ...row,
  id: Number(row.id),
  vacation1: row.vacation1,
  vacation2: row.vacation2,
  vacation3: row.vacation3,
});

router.get("/agents", async (_req, res) => {
  const rows = await db.select().from(agentsTable).orderBy(agentsTable.name);
  res.json(ListAgentsResponse.parse(rows.map(toAgent)));
});

router.post("/agents", async (req, res) => {
  const input = CreateAgentBody.parse(req.body);
  const [row] = await db.insert(agentsTable).values(input).returning();
  res.status(201).json(toAgent(row));
});

router.patch("/agents/:id", async (req, res) => {
  const id = Number(req.params.id);
  const input = UpdateAgentBody.parse(req.body);
  const [row] = await db.update(agentsTable).set(input).where(eq(agentsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Agente não encontrado" });
    return;
  }
  res.json(toAgent(row));
});

router.delete("/agents/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(agentsTable).where(eq(agentsTable.id, id));
  res.status(204).send();
});

router.get("/schedule", async (req, res) => {
  const { month } = ListScheduleQueryParams.parse(req.query);
  const monthStart = month ? `${month}-01` : undefined;
  const monthEnd = month
    ? (() => {
        const [year, monthNumber] = month.split("-").map(Number);
        const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
        return nextMonth.toISOString().slice(0, 10);
      })()
    : undefined;
  const rows = await db
    .select({ id: scheduleTable.id, agentId: scheduleTable.agentId, agentName: agentsTable.name, date: scheduleTable.date, shift: scheduleTable.shift, post: scheduleTable.post, status: scheduleTable.status })
    .from(scheduleTable)
    .innerJoin(agentsTable, eq(scheduleTable.agentId, agentsTable.id))
    .where(month ? and(gte(scheduleTable.date, monthStart!), lt(scheduleTable.date, monthEnd!)) : undefined)
    .orderBy(scheduleTable.date);
  res.json(ListScheduleResponse.parse(rows));
});

router.post("/schedule", async (req, res) => {
  const input = CreateScheduleEntryBody.parse(req.body);
  const [row] = await db.insert(scheduleTable).values(input).returning();
  const [agent] = await db.select({ name: agentsTable.name }).from(agentsTable).where(eq(agentsTable.id, row.agentId));
  res.status(201).json({ ...row, agentName: agent?.name ?? "Agente" });
});

router.get("/hours", async (_req, res) => {
  const rows = await db
    .select({ id: hoursTable.id, agentId: hoursTable.agentId, agentName: agentsTable.name, date: hoursTable.date, type: hoursTable.type, hours: hoursTable.hours, note: hoursTable.note })
    .from(hoursTable)
    .innerJoin(agentsTable, eq(hoursTable.agentId, agentsTable.id))
    .orderBy(hoursTable.date);
  res.json(ListHoursResponse.parse(rows.map((row) => ({ ...row, hours: Number(row.hours) }))));
});

router.post("/hours", async (req, res) => {
  const input = CreateHoursEntryBody.parse(req.body);
  const [row] = await db.insert(hoursTable).values({ ...input, hours: String(input.hours) }).returning();
  const [agent] = await db.select({ name: agentsTable.name }).from(agentsTable).where(eq(agentsTable.id, row.agentId));
  res.status(201).json({ ...row, agentName: agent?.name ?? "Agente", hours: Number(row.hours) });
});

router.get("/dashboard", async (_req, res) => {
  const [agents, hours, schedule] = await Promise.all([
    db.select().from(agentsTable),
    db.select().from(hoursTable),
    db.select({ post: scheduleTable.post }).from(scheduleTable).where(eq(scheduleTable.date, new Date().toISOString().slice(0, 10))).limit(1),
  ]);
  const positiveHours = hours.filter((entry) => entry.type === "credit").reduce((sum, entry) => sum + Number(entry.hours), 0);
  const negativeHours = hours.filter((entry) => entry.type === "debit").reduce((sum, entry) => sum + Number(entry.hours), 0);
  res.json(GetDashboardResponse.parse({
    totalAgents: agents.length,
    onDuty: agents.filter((agent) => agent.onDuty).length,
    vacationSoon: agents.filter((agent) => [agent.vacation1, agent.vacation2, agent.vacation3].some(Boolean)).length,
    positiveHours,
    negativeHours,
    todayPost: schedule[0]?.post ?? "Sem escala registrada",
  }));
});

export default router;