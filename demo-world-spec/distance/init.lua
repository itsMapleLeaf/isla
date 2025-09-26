local world = Isla.world {
	name = "Distance",
	description = "𝘀 𝘂 𝗿 𝘃 𝗶 𝘃 𝗲   𝘁 𝗵 𝗲   𝗱 𝗶 𝘀 𝘁 𝗮 𝗻 𝗰 𝗲",
	author = "MapleLeaf",
}

-- options defined here?

local TRACK_TAG <const> = "Tracks"

world.starting_items = function(items)
	-- TODO: have player options available here for a starter item config
	return Isla.random_with_tag(items, TRACK_TAG, 3)
end

world.goal = function(state)
	-- TODO: have player options available here for completion config
	local track_tasks = Isla.tasks_with_tag(state.tasks, TRACK_TAG)
	return Isla.has_percent_completed(track_tasks, 0.75)
end

--- Arcade: levels unlocked individually
--- data format:
--- {"Set Name": ["Level 1", "Level 2", ...], ...}
---@type {[string]:string[]}
local arcade_data = Isla.load_json("arcade.json")

for set, levels in pairs(arcade_data) do
	for level_index, level in ipairs(levels) do
		local set_tag = "Arcade - " .. set

		local item = world.item {
			-- "01 Chroma (Ignition)"
			name = string.format("%02d %s (%s)", level_index + 1, level, set),
			tags = { TRACK_TAG, set_tag },
		}

		world.task {
			name = item.name,
			tags = { TRACK_TAG, set_tag },
			needs = { item },
		}
	end
end

--- Campaigns: unlocked all at once by single items
--- data format:
--- {"Campaign Name": ["Level 1", "Level 2", ...], ...}
---@type {[string]:string[]}
local campaign_data = Isla.load_json("campaign.json")

for campaign, levels in pairs(campaign_data) do
	local campaign_tag = "Campaign - " .. campaign

	local item = world.item {
		name = campaign,
		tags = { TRACK_TAG, campaign_tag },
	}

	for level_index, level in ipairs(levels) do
		world.task {
			-- "01 Instantiation (Adventure)"
			name = string.format("%02d %s (%s)", level_index + 1, level, campaign),
			tags = { TRACK_TAG, campaign_tag },
			needs = { item },
		}
	end
end

return world
