import type { ClientMessage, ServerMessage } from "@isla/shared"
import console from "node:console"
import { createInterface } from "node:readline/promises"
import WebSocket from "ws"

let inventory: string[] = []
let locations: string[] = []

const socket = new WebSocket("ws://localhost:8080")

function sendSocketMessage(message: ClientMessage) {
	socket.send(JSON.stringify(message))
}

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
})

socket.on("open", () => {
	sendSocketMessage({
		type: "status",
		player: "maple",
		world: "SDVX",
	})
})

socket.on("message", async (data) => {
	const message = JSON.parse(data.toString()) as ServerMessage
	if (message.type === "status") {
		if (message.victory) {
			console.log("You win!")
			console.log()
		}

		inventory = message.inventory
		locations = message.accessibleLocations
	}

	console.log("Items:")
	for (const item of inventory) {
		console.log(`- ${item}`)
	}
	console.log()

	const options = []

	for (const location of locations) {
		options.push({
			name: `Visit ${location}`,
			action: () => {
				sendSocketMessage({
					type: "visit",
					player: "maple",
					world: "SDVX",
					location,
				})
			},
		})
	}

	options.push({
		name: "Exit",
		action: () => process.exit(0),
	})

	for (const [index, option] of options.entries()) {
		console.log(`${index + 1}. ${option.name}`)
	}
	console.log()

	let answer
	do {
		const input = (await rl.question("> ")).trim()
		console.log()
		answer = options[Number(input) - 1]
	} while (!answer)

	answer.action()
})
