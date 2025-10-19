import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/design")({
	component: RouteComponent,
})

function RouteComponent() {
	return (
		<div className="grid gap-4 p-4">
			<section className="grid gap-2">
				<p>Grays</p>
				<div className="flex gap-3">
					{[
						"bg-gray-50",
						"bg-gray-100",
						"bg-gray-200",
						"bg-gray-300",
						"bg-gray-400",
						"bg-gray-500",
						"bg-gray-600",
						"bg-gray-700",
						"bg-gray-800",
						"bg-gray-900",
					].map((bgClass) => (
						<div
							key={bgClass}
							className={`${bgClass} size-16 rounded-full border border-gray-50`}
						/>
					))}
				</div>
			</section>
			<section className="grid gap-2">
				<p>Primary</p>
				<div className="flex gap-3">
					{[
						"bg-primary-50",
						"bg-primary-100",
						"bg-primary-200",
						"bg-primary-300",
						"bg-primary-400",
						"bg-primary-500",
						"bg-primary-600",
						"bg-primary-700",
						"bg-primary-800",
						"bg-primary-900",
					].map((bgClass) => (
						<div
							key={bgClass}
							className={`${bgClass} size-16 rounded-full border border-primary-50`}
						/>
					))}
				</div>
			</section>
		</div>
	)
}
