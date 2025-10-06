import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth";
import { Separator } from "@radix-ui/react-separator";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Report } from "@/types/report";

import * as React from "react";

import { SearchForm } from "@/components/search-form";
import { VersionSwitcher } from "@/components/version-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { User } from "better-auth/types";

export type UserProfile = {
	id: number;
	name: string;
	points: number;
	role: string;
};

export const DashboardProfile = () => {
	const navigate = useNavigate();
	const [str, setStr] = useState("GreenMapper");

	const location = useLocation();
	const { data: user } = useSWR<UserProfile>("/users/me", fetcher);

	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink onClick={() => setStr("Green Mapper")}>
								{str}
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Профиль</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Button
					className="ml-auto"
					onClick={() => {
						authClient.signOut().then(() => navigate("/"));
					}}
				>
					Выйти
				</Button>
			</header>
			<div className="flex flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
				<div className="flex items-center gap-3 ml-2">
					<Avatar className="h-10 w-10">
						<AvatarImage src="https://github.com/shadcn.png" alt="@username" />
						<AvatarFallback>UN</AvatarFallback>
					</Avatar>
					<span className="font-medium text-base truncate">
						{user?.name || "Загрузка..."}
					</span>
				</div>
				<span className="font-medium text-base truncate">
					Статус: {user?.role || "Загрузка..."}
				</span>
				<span className="font-medium text-base truncate">
					Рейтинг: {!isNaN(user?.points!) ? user?.points : "Загрузка..."}
				</span>
			</div>
		</>
	);
};
