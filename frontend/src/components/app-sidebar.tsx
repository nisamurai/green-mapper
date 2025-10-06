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
import { useNavigate, useLocation } from "react-router";
import { authClient } from "@/lib/auth";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import type { User } from "better-auth/types";

export type UserProfile = {
	id: number;
	name: string;
	points: number;
	role: string;
};

const data = {
	cities: ["Санкт-Петербург"],
	navMain: [
		{
			title: "Навигация",
			url: "#",
			adminOnly: false,
			items: [
				{
					title: "Профиль",
					url: "/dashboard/profile",
					// isActive: true,
				},
				{
					title: "Карта",
					url: "/dashboard",
				},
				{
					title: "Заявки",
					url: "/dashboard/reports",
				},
				{
					title: "Создать заявку",
					url: "/dashboard/create-report",
				},
			],
		},
		{
			title: "Вкладки для Админа",
			adminOnly: true,
			url: "#",
			items: [
				{
					title: "Панель управления заявками",
					url: "/dashboard/reports-panel",
				},
			],
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const navigate = useNavigate();
	const location = useLocation();
	const { data: user } = useSWR<UserProfile>("/users/me", fetcher);

	return (
		<Sidebar {...props}>
			<SidebarHeader>
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
				<VersionSwitcher
					versions={data.cities}
					defaultVersion={data.cities[0]}
				/>
				<SearchForm />
			</SidebarHeader>
			<SidebarContent>
				{/* We create a SidebarGroup for each parent. */}
				{data.navMain
					.filter(({ adminOnly }) =>
						adminOnly ? user?.role === "admin" : true,
					)
					.map((item) => (
						<SidebarGroup key={item.title}>
							<SidebarGroupLabel>{item.title}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{item.items.map((item) => (
										<SidebarMenuItem
											onClick={() => navigate(item.url)}
											key={item.title}
										>
											<SidebarMenuButton
												asChild
												isActive={item.url === location.pathname}
											>
												<a>{item.title}</a>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
