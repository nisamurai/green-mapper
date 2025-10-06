import { useEffect } from "react";
import { useNavigate } from "react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet } from "react-router";
import { authClient } from "@/lib/auth";
import { LoadingSpinner } from "./ui/spinner";

export const DashboardLayout = () => {
	const { data: session, isPending, error } = authClient.useSession();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isPending && !session) {
			navigate("/auth/login", { replace: true });
		}
	}, [isPending, session, navigate]);

	if (isPending)
		return (
			<div className="flex items-center justify-center max-h-maxflex min-h-svh flex-col">
				<LoadingSpinner />
			</div>
		);

	if (error) return <div>Error: {error.message}</div>;

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
};
