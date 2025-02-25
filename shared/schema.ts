import { z } from "zod";

export const userSchema = z.object({
  _id: z.string().optional(),
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string(),
  email: z.string().email().optional(),
  role: z.enum(["coach", "student"]),
  createdAt: z.date().optional(),
  preferences: z.object({
    defaultMeetingProvider: z.enum(["zoom", "google_meet"]).optional(),
    defaultMeetingUrl: z.string().url().optional(),
  }).optional(),
});

export const puzzleSchema = z.object({
  _id: z.string().optional(),
  fen: z.string(),
  solution: z.array(z.string()),
  themes: z.array(z.string()),
  createdAt: z.date().optional(),
  createdBy: z.string(), // coach ID
});

export const assignmentSchema = z.object({
  _id: z.string().optional(),
  puzzleId: z.string(),
  studentId: z.string(),
  completed: z.boolean().default(false),
  assignedAt: z.date().optional()
});

export const classScheduleSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  coachId: z.string(),
  studentIds: z.array(z.string()),
  startTime: z.string(),
  endTime: z.string(),
  timezone: z.string().default("UTC"),
  meetingUrl: z.string().url("Invalid meeting URL"),
  meetingProvider: z.enum(["zoom", "google_meet"]),
  status: z.enum(["not_started", "in_progress", "completed"]).default("not_started"),
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  createdAt: z.date().optional()
});

export const updateProfileSchema = userSchema
  .pick({ name: true, email: true })
  .extend({
    currentPassword: z.string().min(6).optional(),
    newPassword: z.string().min(6).optional(),
  });

export const updatePreferencesSchema = z.object({
  defaultMeetingProvider: z.enum(["zoom", "google_meet"]),
  defaultMeetingUrl: z.string().url("Invalid meeting URL"),
});

export const insertUserSchema = userSchema.omit({ _id: true, createdAt: true });
export const loginSchema = userSchema.pick({ username: true, password: true });
export const createStudentSchema = userSchema.pick({ username: true, name: true });
export const insertPuzzleSchema = puzzleSchema.omit({ _id: true, createdAt: true });
export const insertAssignmentSchema = assignmentSchema.omit({ _id: true, assignedAt: true });
export const insertClassScheduleSchema = classScheduleSchema.omit({ _id: true, createdAt: true, status: true, actualStartTime: true, actualEndTime: true, attendees: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateStudent = z.infer<typeof createStudentSchema>;
export type Puzzle = z.infer<typeof puzzleSchema>;
export type InsertPuzzle = z.infer<typeof insertPuzzleSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type ClassSchedule = z.infer<typeof classScheduleSchema>;
export type InsertClassSchedule = z.infer<typeof insertClassScheduleSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;