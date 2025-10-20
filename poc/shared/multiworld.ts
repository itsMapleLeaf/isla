import console from "node:console"
import { randomInt } from "node:crypto"
import { range, shuffle } from "es-toolkit"
import { raise } from "./helpers.ts"

type WorldSpec = {
	name: string
	startingItems: Array<{ tag: string; count: number }>
	items: { [name: string]: ItemSpec }
	tasks: { [name: string]: TaskSpec }
}

type ItemSpec = {
	tags?: Array<string>
	count?: number
}

type TaskSpec = {
	tags?: Array<string>
	needs: { amount?: number } & ({ item: string } | { itemTag: string })
	victory?: boolean
}

const voltexWorldSpec: WorldSpec = {
	name: "SOUND VOLTEX",
	startingItems: [{ tag: "Songs", count: 1 }],
	items: {
		"666": {
			tags: ["Songs"],
		},
		"Blastix Riotz": {
			tags: ["Songs"],
		},
		"Gekkou Ranbu": {
			tags: ["Songs"],
		},
		CHAIN: {
			count: 3,
		},
	},
	tasks: {
		"666": {
			tags: ["Songs"],
			needs: { item: "666" },
		},
		"Blastix Riotz": {
			tags: ["Songs"],
			needs: { item: "Blastix Riotz" },
		},
		"Gekkou Ranbu": {
			tags: ["Songs"],
			needs: { item: "Gekkou Ranbu" },
		},
		"Boss Song": {
			needs: { item: "CHAIN", amount: 3 },
			victory: true,
		},
	},
}

type PlayerSpec = {
	world: WorldSpec
}

class Player {
	readonly id: string
	readonly name: string
	readonly spec: PlayerSpec
	readonly tasks = new Map<string, Task>()
	readonly items = new Map<string, Item>()

	constructor(name: string, spec: PlayerSpec) {
		this.id = `player:${name}`
		this.name = name
		this.spec = spec

		for (const [taskName, taskSpec] of Object.entries(spec.world.tasks)) {
			this.defineTask(taskName, taskSpec)
		}

		for (const [itemName, itemSpec] of Object.entries(spec.world.items)) {
			for (const _ of range(itemSpec.count ?? 1)) {
				this.defineItem(itemName, itemSpec)
			}
		}
	}

	defineTask(name: string, spec: TaskSpec) {
		const task = new Task(name, spec, this)
		this.tasks.set(task.id, task)
		return task
	}

	defineItem(name: string, spec: ItemSpec) {
		const item = new Item(name, spec, this)
		this.items.set(item.id, item)
		return item
	}

	get inventory() {
		return this.items.values().filter((item) => item.collected)
	}

	get accessibleTasks() {
		return this.accessibleTasksWith(this.inventory)
	}

	accessibleTasksWith(inventory: Iterable<Item>) {
		return this.tasks.values().filter((task) => {
			const requirement = task.spec.needs
			const requiredAmount = Math.max(requirement.amount ?? 1, 1)

			let matching
			if ("item" in requirement) {
				matching = Iterator.from(inventory).filter(
					(item) => item.name === requirement.item,
				)
			} else {
				matching = Iterator.from(inventory).filter((item) =>
					item.spec.tags?.includes(requirement.itemTag),
				)
			}

			return matching.take(requiredAmount).toArray().length === requiredAmount
		})
	}
}

class Task {
	readonly id
	readonly items: Array<Item> = []

	constructor(
		readonly name: string,
		readonly spec: TaskSpec,
		readonly player: Player,
	) {
		this.id = `task:${player.name}:${name}`
	}
}

class Item {
	readonly id
	task?: Task
	collected?: boolean

	constructor(
		readonly name: string,
		readonly spec: ItemSpec,
		readonly player: Player,
	) {
		this.id = `task:${player.name}:${name}:${range(5).map(() => randomInt(10))}`
	}
}

type MultiWorldSpec = {
	name: string
	players: { [name: string]: PlayerSpec }
}

class MultiWorld {
	readonly name
	readonly players = new Map<string, Player>()
	readonly tasks = new Map<string, Task>()
	readonly items = new Map<string, Item>()

	constructor(readonly spec: MultiWorldSpec) {
		this.name = spec.name

		for (const [playerName, playerSpec] of Object.entries(spec.players)) {
			const player = this.definePlayer(playerName, playerSpec)
			for (const task of player.tasks.values()) {
				this.tasks.set(task.id, task)
			}
			for (const item of player.items.values()) {
				this.items.set(item.id, item)
			}
		}
	}

	definePlayer(name: string, spec: PlayerSpec) {
		const player = new Player(name, spec)
		this.players.set(player.id, player)
		return player
	}
}

const multi = new MultiWorld({
	name: "oops, all voltex!",
	players: {
		Player1: { world: voltexWorldSpec },
		// Player2: { world: voltexWorldSpec },
		// Player3: { world: voltexWorldSpec },
	},
})

for (const player of multi.players.values()) {
	const playerItemPool = shuffle(player.items.values().toArray())

	for (const entry of player.spec.world.startingItems) {
		for (const _ of range(entry.count)) {
			const itemIndex = playerItemPool.findIndex((item) =>
				item.spec.tags?.includes(entry.tag),
			)
			if (itemIndex === -1) {
				raise(
					`invalid starting item entry (tag not found): ${JSON.stringify(entry)}`,
				)
			}
			const [item] = playerItemPool.splice(itemIndex, 1)
			item.collected = true
		}
	}
}

const itemPool = shuffle(
	multi.items
		.values()
		.filter((item) => !item.collected)
		.toArray(),
)

for (const item of itemPool) {
	const validTasks = multi.players
		.values()
		.flatMap((player) =>
			player.accessibleTasksWith([
				...player.inventory,
				...player.items.values().filter((it) => it.task),
			]),
		)
		.filter((task) => !task.spec.victory)
		.toArray()

	if (validTasks.length === 0) {
		raise("no valid tasks")
	}

	// prioritize tasks with the least items in them
	const lowestPlacedItemCount = validTasks
		.map((t) => t.items.length)
		.reduce((a, b) => Math.min(a, b))

	const priorityTasks = validTasks.filter(
		(task) => task.items.length === lowestPlacedItemCount,
	)

	console.log(
		`Valid tasks for ${item.name} (${priorityTasks.length}):`,
		priorityTasks.map((it) => `${it.name} (${it.player.name})`),
	)

	const task = priorityTasks[randomInt(priorityTasks.length)]
	item.task = task
	task.items.push(item)
}

for (const player of multi.players.values()) {
	console.log(`== ${player.name} ==`)
	console.log("Inventory:")
	for (const item of player.items.values()) {
		if (item.collected) {
			console.log(`- ${item.name}`)
		}
	}
	console.log()

	console.log("Tasks:")
	for (const task of player.tasks.values()) {
		console.log(
			`- ${task.name} [${task.items.map((item) => `${item.name} (${item.player.name})`).join(", ")}]`,
		)
	}
	console.log()
}
