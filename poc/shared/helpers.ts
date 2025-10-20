import { randomInt } from "node:crypto"

export function popRandom<T>(items: Array<T>): T | undefined {
	const [item] = items.splice(randomInt(items.length), 1)
	return item
}

export function raise(error: string | object): never {
	throw typeof error === "string" ? new Error(error) : error
}
