import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	worlds: defineTable({
		name: v.string(),
	}),

	tasks: defineTable({
		name: v.string(),
		worldId: v.id("worlds"),
	}),

	items: defineTable({
		name: v.string(),
		worldId: v.id("worlds"),
		taskId: v.id("tasks"),
		collected: v.boolean(),
	}),
})
