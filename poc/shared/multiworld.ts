import console from "node:console"
import { randomInt } from "node:crypto"
import { range, shuffle, without } from "es-toolkit"
import { raise } from "./helpers.ts"

type WorldSpec = {
	name: string
	startingItems: Array<({ name: string } | { tag: string }) & { count: number }>
	items: { [name: string]: ItemSpec }
	tasks: { [name: string]: TaskSpec }
}

type ItemSpec = {
	tags?: Array<string>
	count?: number
}

type TaskSpec = {
	tags?: Array<string>
	needs?: { amount?: number } & ({ item: string } | { itemTag: string })
	victory?: boolean
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

	constructor(
		name: string,
		spec: PlayerSpec,
		readonly multi: MultiWorld,
	) {
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

	get inventory() {
		return this.items.values().filter((item) => item.collected)
	}

	get placedItems() {
		return this.items.values().filter((item) => item.task)
	}

	get accessibleTasks() {
		return this.accessibleTasksWith(this.inventory)
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

	accessibleTasksWith(inventory: Iterable<Item>) {
		return this.tasks
			.values()
			.filter((task) => task.isAccessibleWith(inventory))
	}
}

class Task {
	readonly id

	constructor(
		readonly name: string,
		readonly spec: TaskSpec,
		readonly player: Player,
	) {
		this.id = `task:${player.name}:${name}`
	}

	get items() {
		return this.player.multi.items.values().filter((i) => i.task === this)
	}

	isAccessibleWith(inventory: Iterable<Item>) {
		const requirement = this.spec.needs
		if (!requirement) return true

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

	get nonVictoryTasks() {
		return this.tasks.values().filter((t) => !t.spec.victory)
	}

	definePlayer(name: string, spec: PlayerSpec) {
		const player = new Player(name, spec, this)
		this.players.set(player.id, player)
		return player
	}
}

/**
 * This algo ensures a valid playthrough by placing items as if it were
 * collecting them in a playthrough.
 *
 * It also attempts to place items in tasks by layers, to spread out item counts
 * per task throughout the multiworld
 *
 * If it cannot fill a layer due to restrictive logic (see {@link dungeonKeys}),
 * it places the last item it's able for that layer, then continues onto a new
 * layer.
 *
 * This algo _does not_ ensure that every task has an item, since that's
 * sometimes not possible or expected
 *
 * And it's also probably really bad on perf lol, need to stress test it with
 * the full 13k voltex manual
 */
function generate(multi: MultiWorld) {
	for (const player of multi.players.values()) {
		let playerItemPool = shuffle(player.items.values().toArray())

		for (const entry of player.spec.world.startingItems) {
			for (const _ of range(entry.count)) {
				let item
				if ("name" in entry) {
					item = playerItemPool.find((i) => i.name === entry.name)
				} else {
					item = playerItemPool.find((i) => i.spec.tags?.includes(entry.tag))
				}

				if (!item) {
					raise(
						`unable to add starting item for ${player.name}: ${JSON.stringify(entry)}`,
					)
				}

				item.collected = true
				playerItemPool = without(playerItemPool, item)
			}
		}
	}

	const itemPool = shuffle(
		multi.items
			.values()
			.filter((item) => !item.collected)
			.toArray(),
	)

	let taskLayer = shuffle(multi.nonVictoryTasks.toArray())
	let placingItem
	let skipCount = 0

	while ((placingItem = itemPool.pop())) {
		const nextTask = taskLayer.find((t) =>
			t.isAccessibleWith([...t.player.inventory, ...t.player.placedItems]),
		)

		// since we're generating by placing items as if we were collecting them,
		// there should always be a task accessible _at some point_ in generation,
		// and if not, the world's logic is impossible
		// ...I think
		if (!nextTask) {
			// this error msg needs improvement lol
			raise("fatal: no accessible task at current gen state")
		}

		let cannotFillLayer = false

		if (taskLayer.length > 1) {
			// our goal is to fill the layer (the current list of every task in the world)
			//
			// to ensure we can fill the layer, we need to check if,
			// after placing this task, will there still be accessible tasks in the layer afterward?
			const nextAccessibleTask = taskLayer.find(
				(t) =>
					t !== nextTask &&
					t.isAccessibleWith([
						...t.player.inventory,
						...t.player.placedItems,
						placingItem!,
					]),
			)

			if (!nextAccessibleTask) {
				// if there are no tasks after placing this item,
				// skip it and add it back to the pool to try placing it on a later iteration,
				// while keeping track of how many items we've skipped from this condition
				if (skipCount < itemPool.length + 1) {
					skipCount += 1
					itemPool.unshift(placingItem)
					continue
				}

				// if we're here, we skipped every item and can't find one to fill the layer,
				// so set this to know that we need to restart with a new layer
				cannotFillLayer = true
			}
		}

		skipCount = 0

		placingItem.task = nextTask

		taskLayer = without(taskLayer, nextTask)
		if (taskLayer.length === 0 || cannotFillLayer) {
			taskLayer = shuffle(multi.nonVictoryTasks.toArray())
		}
	}
}

if (import.meta.main) {
	/**
	 * An example world that forces several items into one location from its
	 * logic, such that they can't be spread out from layered placement
	 *
	 * To see this in action, uncomment all worlds but this one in the multiworld
	 * spec
	 *
	 * **Caveat:** the throne room key will sometimes appear bunched up at the
	 * entrance with the dungeon keys instead of being in the dungeon.
	 *
	 * I think this is fine (especially for an MVP), but it might be more ideal if
	 * we wanted to ensure the flattest possible world with the most possible
	 * locations filled... somehow
	 */
	const dungeonKeys: WorldSpec = {
		name: "Dungeon Keys",
		startingItems: [{ name: "Sword", count: 1 }],
		items: {
			Sword: {},
			"Dungeon Key": {
				count: 5,
			},
			"Throne Room Key": {
				count: 1,
			},
		},
		tasks: {
			Entrance: {},
			Dungeon: {
				needs: { item: "Dungeon Key", amount: 5 },
			},
			"Throne Room": {
				needs: { item: "Throne Room Key" },
				victory: true,
			},
		},
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

	const multi = new MultiWorld({
		name: "oops, all voltex!",
		players: {
			Grace: { world: voltexWorldSpec },
			Rasis: { world: voltexWorldSpec },
			Kirito: { world: dungeonKeys },
		},
	})

	generate(multi)

	console.log()
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
				`- ${task.name} [${task.items
					.map((item) => `${item.name} (${item.player.name})`)
					.toArray()
					.join(", ")}]`,
			)
		}
		console.log()
	}
}
