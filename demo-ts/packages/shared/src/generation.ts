export declare namespace Generation {
	type Result = {
		players: {
			[playerName: string]: {
				[worldName: string]: World
			}
		}
	}

	type World = {
		inventory: string[]
		locations: {
			[name: string]: string[]
		}
	}

	type Item = string
}
