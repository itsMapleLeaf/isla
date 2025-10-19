//  @ts-check

/** @type {import("prettier").Config} */
const config = {
	semi: false,
	useTabs: true,
	htmlWhitespaceSensitivity: "ignore",
	plugins: ["prettier-plugin-jsdoc", "prettier-plugin-tailwindcss"],
}

export default config
