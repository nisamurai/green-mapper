import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	decimal,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	points: integer("points").notNull().default(0),
	role: varchar("role", { length: 5 }).$type<"user" | "admin">().default("user"),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});

export const issueTypes = pgTable("issue_types", {
  typeId: serial("type_id").primaryKey(),
  name: varchar("name", { length: 250 }).notNull().unique(),
});

export const issueStatuses = pgTable("issue_statuses", {
  statusId: serial("status_id").primaryKey(),
  name: varchar("name", { length: 20 }).notNull().unique(),
});

export const issues = pgTable("issues", {
  issueId: serial("issue_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  typeId: integer("type_id")
    .notNull()
    .references(() => issueTypes.typeId),
  statusId: integer("status_id")
    .notNull()
    .references(() => issueStatuses.statusId),
  shortDescription: varchar("short_description", { length: 200 }).notNull(),
  detailedDescription: varchar("detailed_description", { length: 1000 }),
  address: varchar("address", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
  expectedResolutionDate: date("expected_resolution_date"),
});

// Фотографии
export const photos = pgTable("photos", {
  photoId: serial("photo_id").primaryKey(),
  issueId: integer("issue_id")
    .notNull()
    .references(() => issues.issueId),
  filePath: varchar("file_path", { length: 255 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Комментарии
export const comments = pgTable("comments", {
  commentId: serial("comment_id").primaryKey(),
  issueId: integer("issue_id")
    .notNull()
    .references(() => issues.issueId),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Действия администраторов
export const adminActions = pgTable("admin_actions", {
  actionId: serial("action_id").primaryKey(),
  issueId: integer("issue_id")
    .notNull()
    .references(() => issues.issueId),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  actionDate: timestamp("action_date").defaultNow(),
});

// Отношения
export const usersRelations = relations(user, ({ many }) => ({
  issues: many(issues),
  comments: many(comments),
  adminActions: many(adminActions),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  user: one(user, { fields: [issues.userId], references: [user.id] }),
  type: one(issueTypes, { fields: [issues.typeId], references: [issueTypes.typeId] }),
  status: one(issueStatuses, { fields: [issues.statusId], references: [issueStatuses.statusId] }),
  photos: many(photos),
  comments: many(comments),
  adminActions: many(adminActions),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  issue: one(issues, { fields: [photos.issueId], references: [issues.issueId] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, { fields: [comments.issueId], references: [issues.issueId] }),
  admin: one(user, { fields: [comments.adminId], references: [user.id] }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  issue: one(issues, { fields: [adminActions.issueId], references: [issues.issueId] }),
  admin: one(user, { fields: [adminActions.adminId], references: [user.id] }),
}));