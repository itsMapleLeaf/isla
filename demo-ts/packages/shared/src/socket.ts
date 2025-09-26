export type ClientMessage =
	| {
			type: "status"
			player: string
			world: string
	  }
	| {
			type: "visit"
			player: string
			world: string
			location: string
	  }
	| {
			type: "win"
			player: string
			world: string
	  }

export type ServerMessage = {
	type: "status"
	player: string
	world: string
	inventory: string[]
	accessibleLocations: string[]
	victory: boolean
}
