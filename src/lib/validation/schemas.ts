import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱。"),
  password: z.string().min(1, "请输入密码。"),
});

export const projectSchema = z.object({
  name: z.string().min(1, "项目名称必填。"),
  code: z.string().optional(),
  templateId: z.enum(["agile", "waterfall"]),
  ownerId: z.string().min(1, "请选择负责人。"),
  status: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  testDate: z.string().optional(),
  acceptanceDate: z.string().optional(),
  releaseDate: z.string().optional(),
});

export const issueSchema = z.object({
  title: z.string().min(1, "事项标题必填。"),
  type: z.string().min(1),
  ownerId: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  status: z.string().min(1),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
  actualHours: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  next: z.string().optional(),
});

export const timeEntrySchema = z.object({
  projectId: z.string().min(1, "请选择项目。"),
  issueId: z.string().optional(),
  workDate: z.string().min(1, "请选择日期。"),
  hours: z.coerce.number().min(0.1, "工时必须大于 0。").max(24, "单日工时不能超过 24。"),
  description: z.string().optional(),
});

export const costRecordSchema = z.object({
  projectId: z.string().min(1, "请选择项目。"),
  plannedPersonDays: z.coerce.number().min(0.1, "计划人天必须大于 0。"),
  standardHoursPerDay: z.coerce.number().min(0.5).max(24),
  notes: z.string().optional(),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "姓名必填。"),
  email: z.string().email("邮箱格式不正确。"),
  role: z.enum(["ADMIN", "MEMBER"]),
  initialPassword: z.string().min(8, "密码至少 8 位。"),
  confirmInitialPassword: z.string().min(8),
}).refine((value) => value.initialPassword === value.confirmInitialPassword, {
  message: "确认初始密码必须一致。",
  path: ["confirmInitialPassword"],
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码。"),
  newPassword: z.string().min(8, "新密码至少 8 位。"),
  confirmPassword: z.string().min(8),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "确认密码必须一致。",
  path: ["confirmPassword"],
});
