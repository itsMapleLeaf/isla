---@class WorldSpec
---@field meta WorldMeta
---@field items ItemSpec[]
---@field item fun(args: {name:string, tags?:string[] }): ItemSpec
---@field tasks ItemSpec[]
---@field task fun(args: {name:string, tags?:string[], needs?: ItemSpec[] | WorldStateQuery}): ItemSpec
---@field tags {[string]:TagSpec}
---@field starting_items fun(all_items: ItemSpec[]): ItemSpec[]
---@field goal WorldStateQuery

---@class WorldMeta
---@field name string
---@field description string
---@field author string

---@class ItemSpec
---@field name string
---@field tags string[]

---@class TaskSpec
---@field name string
---@field tags string[]
---@field needs ItemSpec[] | WorldStateQuery

---@class TagSpec
---@field name string

---@alias WorldStateQuery fun(state: WorldState): boolean

---@class WorldState
---@field items ItemSpec[]
---@field tasks TaskState[]

---@class TaskState: TaskSpec
---@field completed boolean

--- Global world spec API for Isla
Isla = {}

---@param meta WorldMeta
---@return WorldSpec
function Isla.world(meta)
	---@type WorldSpec
	local world

	world = {
		meta = meta,
		items = {},
		tasks = {},
		tags = {},
		goal = function() return false end,
		starting_items = function() return {} end,

		item = function(args)
			local item = {
				name = args.name,
				tags = args.tags or {}
			}
			table.insert(world.items, item)
			return item
		end,

		task = function(args)
			local task = {
				name = args.name,
				tags = args.tags or {},
				needs = args.needs or {},
			}
			table.insert(world.tasks, task)
			return task
		end,
	}

	return world
end

--- Load JSON data from file
---@param filename string
---@return any data
function Isla.load_json(filename)
	-- This would typically read and parse a JSON file
	-- For now, return empty table as placeholder
	return {}
end

--- Get tasks with a specific tag
---@param tasks WorldState
---@param tag string
---@return TaskState[]
function Isla.tasks_with_tag(tasks, tag)
	local result = {}
	for _, task in ipairs(tasks) do
		for _, task_tag in ipairs(task.tags) do
			if task_tag == tag then
				table.insert(result, task)
				break
			end
		end
	end
	return result
end

--- Check if a percentage of tasks are completed
---@param tasks TaskState[]
---@param percent number required completion percentage (0.0 to 1.0)
---@return boolean completed
function Isla.has_percent_completed(tasks, percent)
	if #tasks == 0 then return false end

	local completed = 0
	for _, task in ipairs(tasks) do
		if task.completed then
			completed = completed + 1
		end
	end

	return (completed / #tasks) >= percent
end

---@param items ItemSpec[]
---@param tag string
---@param count integer
function Isla.random_with_tag(items, tag, count)
	error("not impelemented")
	return {}
end
