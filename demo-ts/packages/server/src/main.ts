import type { ClientMessage, ServerMessage } from "@isla/shared"
import WebSocket, { type AddressInfo, WebSocketServer } from "ws"

type World = {
	inventory: string[]
	locations: {
		[location: string]: {
			items: string[]
			requires: Requirement
		}
	}
	victory: {
		requires: Requirement
		achieved: boolean
	}
}

type Requirement = {
	item: string
}

type MultiWorld = {
	players: {
		[player: string]: {
			[world: string]: World
		}
	}
}

const multiworld: MultiWorld = {
	players: {
		maple: {
			SDVX: {
				inventory: ["Blastix Riotz"],
				locations: {
					"Blastix Riotz": {
						items: ["Chronomia"],
						requires: { item: "Blastix Riotz" },
					},
					"Chronomia": {
						items: ["Chrono Diver -PENDULUMS-"],
						requires: { item: "Chronomia" },
					},
					"Chrono Diver -PENDULUMS-": {
						items: ["Absurd Gaff"],
						requires: { item: "Chrono Diver -PENDULUMS-" },
					},
					"Absurd Gaff": {
						items: ["Vividly Impromptu"],
						requires: { item: "Absurd Gaff" },
					},
					"Vividly Impromptu": {
						items: ["AIR"],
						requires: { item: "Vividly Impromptu" },
					},
					"AIR": {
						items: ["PERFECT ULTIMATE CHAIN"],
						requires: { item: "AIR" },
					},
				},
				victory: {
					requires: { item: "PERFECT ULTIMATE CHAIN" },
					achieved: false,
				},
			},
		},
	},
}

function isRequirementSatisfied(requirement: Requirement, world: World) {
	return world.inventory.includes(requirement.item)
}

function getWorldStatus(playerName: string, worldName: string) {
	const player = multiworld.players[playerName]
	if (!player) return

	const world = player[worldName]
	if (!world) return

	const accessibleLocations = Object.entries(world.locations)
		.filter(
			([, location]) =>
				location.items.length > 0 &&
				isRequirementSatisfied(location.requires, world),
		)
		.map(([name]) => name)

	return {
		world,
		inventory: world.inventory,
		accessibleLocations,
	}
}

/** collects a game's items from a location */
function visit(playerName: string, worldName: string, locationName: string) {
	const player = multiworld.players[playerName]
	if (!player) return

	const world = player[worldName]
	if (!world) return

	const location = world.locations[locationName]
	if (!location) return

	world.inventory.push(...location.items.splice(0))
}

function sendClientMessage(client: WebSocket, message: ServerMessage) {
	client.send(JSON.stringify(message))
}

function sendStatus(client: WebSocket, playerName: string, worldName: string) {
	const result = getWorldStatus(playerName, worldName)
	if (!result) return

	sendClientMessage(client, {
		type: "status",
		player: playerName,
		world: worldName,
		inventory: result.inventory,
		accessibleLocations: result.accessibleLocations,
		victory: isRequirementSatisfied(
			result.world.victory.requires,
			result.world,
		),
	})
}

const server = new WebSocketServer({ port: 8080 }, () => {
	const address = server.address() as AddressInfo
	console.info(`listening on ws://localhost:${address.port}`)
})

server.on("connection", (client) => {
	client.on("message", (data) => {
		const message = JSON.parse(data.toString()) as ClientMessage
		console.info(message)

		if (message.type === "status") {
			sendStatus(client, message.player, message.world)
		}

		if (message.type === "visit") {
			visit(message.player, message.world, message.location)
			sendStatus(client, message.player, message.world)
		}
	})
})
