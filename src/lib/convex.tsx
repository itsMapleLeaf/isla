import { ConvexProvider } from "convex/react"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { env } from "../env"

const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL)

export function AppConvexProvider({ children }: { children: React.ReactNode }) {
	return (
		<ConvexProvider client={convexQueryClient.convexClient}>
			{children}
		</ConvexProvider>
	)
}
