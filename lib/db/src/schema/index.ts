// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { boolean, date, integer, numeric, pgTable, serial, text, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const agentsTable = pgTable("security_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  registration: text("registration").notNull().unique(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  onDuty: boolean("on_duty").notNull().default(false),
  birthDate: date("birth_date").notNull(),
  vacation1: date("vacation_1"),
  vacation2: date("vacation_2"),
  vacation3: date("vacation_3"),
  dailyPost: text("daily_post").notNull(),
});

export const scheduleTable = pgTable("security_schedule", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id),
  date: date("date").notNull(),
  shift: text("shift").notNull(),
  post: text("post").notNull(),
  status: text("status").notNull().default("Confirmado"),
});

export const hoursTable = pgTable("security_hours", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id),
  date: date("date").notNull(),
  type: text("type").notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  note: text("note").notNull(),
});

export const insertAgentSchema = createInsertSchema(agentsTable);
export const insertScheduleSchema = createInsertSchema(scheduleTable);
export const insertHoursSchema = createInsertSchema(hoursTable);
export type Agent = typeof agentsTable.$inferSelect;
export type ScheduleEntry = typeof scheduleTable.$inferSelect;
export type HoursEntry = typeof hoursTable.$inferSelect;