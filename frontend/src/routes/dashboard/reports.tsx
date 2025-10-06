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
import { format, subHours } from "date-fns";
import { ru } from "date-fns/locale";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Report } from "@/types/report";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export const DashboardReports = () => {
	const navigate = useNavigate();
	const [str, setStr] = useState("GreenMapper");
	const { data } = useSWR<Report[]>("/reports/", fetcher);

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
							<BreadcrumbPage>Заявки</BreadcrumbPage>
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
			{/* Контейнер, который будет прокручиваться по горизонтали при необходимости */}
			{/* flex-1 позволяет ему занимать все доступное пространство по вертикали */}
			<div className="flex flex-1 flex-col gap-4 p-4 overflow-x-auto">
				{/* Таблица с фиксированной раскладкой и полной шириной контейнера */}
				{/* Это позволяет контролировать ширину столбцов и использовать overflow-x-auto на родительском элементе */}
				<Table className="w-full min-w-[900px] md:table-fixed">
					<TableCaption>Список заявок</TableCaption>
					<TableHeader>
						<TableRow>
							{/* Узкий столбец для ID */}
							<TableHead className="min-w-[30px] max-w-[60px] whitespace-normal break-words">
								ID
							</TableHead>
							{/* Столбцы с фиксированной шириной */}
							<TableHead className="min-w-[30px] max-w-[150px] whitespace-normal break-words">
								Статус
							</TableHead>
							<TableHead className="min-w-[30px] max-w-[150px] whitespace-normal break-words wrap-anywhere">
								Тип
							</TableHead>
							<TableHead className="min-w-[30px] max-w-[160px] whitespace-normal break-words">
								Короткое описание
							</TableHead>
							{/* Столбец Полного описания занимает оставшееся пространство и переносит текст */}
							<TableHead className="whitespace-normal break-words">
								Полное описание
							</TableHead>
							<TableHead className="min-w-[30px] max-w-[150px] whitespace-normal break-words">
								Адрес
							</TableHead>
							{/* Столбцы с фиксированной шириной для дат */}
							<TableHead className="min-w-[30px] max-w-[120px] whitespace-normal break-words">
								Дата создания
							</TableHead>
							<TableHead className="min-w-[30px] max-w-[200px] whitespace-normal break-words">
								Ожидаемая дата решения
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.map(
							({
								issueId,
								statusName,
								detailedDescription,
								address,
								createdAt,
								expectedResolutionDate,
								typeName,
								shortDescription,
							}) => (
								<TableRow key={issueId}>
									{/* Ячейки с переносом строк и обрезкой для предотвращения выхода за границы */}
									<TableCell className="font-medium whitespace-normal break-words overflow-hidden text-ellipsis">
										{issueId}
									</TableCell>
									<TableCell className="whitespace-normal break-words overflow-hidden text-ellipsis">
										{statusName}
									</TableCell>
									<TableCell className="whitespace-normal break-words overflow-hidden text-ellipsis">
										{typeName}
									</TableCell>
									<TableCell className="whitespace-normal break-words overflow-hidden text-ellipsis">
										{shortDescription}
									</TableCell>
									{/* Ячейка Полного описания с переносом строк */}
									<TableCell className="min-w-[200px] whitespace-normal break-words">
										{detailedDescription || (
											<span className="text-gray-500">Нет</span>
										)}
									</TableCell>
									<TableCell className="whitespace-normal break-words overflow-hidden text-ellipsis">
										{address}
									</TableCell>
									<TableCell className="whitespace-normal break-words">
										{/* Убедимся, что дата создания всегда отображается */}
										{createdAt
											? format(
													subHours(new Date(createdAt), 0),
													"dd.MM.yyyy HH:mm",
													{
														locale: ru,
													},
												)
											: "Нет данных"}
									</TableCell>
									<TableCell className="whitespace-normal break-words">
										{expectedResolutionDate &&
											format(
												new Date(expectedResolutionDate),
												"dd.MM.yyyy HH:mm",
												{
													locale: ru,
												},
											)}
									</TableCell>
								</TableRow>
							),
						)}
					</TableBody>
				</Table>
			</div>
		</>
	);
};
