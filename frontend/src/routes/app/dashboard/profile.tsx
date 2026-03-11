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
import { useNavigate } from "react-router";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type UserProfile = {
	id: number;
	name: string;
	points: number;
	role: string;
};

export const DashboardProfile = () => {
	const { data: user } = useSWR<UserProfile>("/users/me", fetcher);
	
	return (
		<>
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
