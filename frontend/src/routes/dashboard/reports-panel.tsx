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

import useSWR, { mutate } from "swr"; // Импортируем mutate для обновления данных
import { fetcher } from "@/lib/fetcher";
// Убедимся, что тип Report включает statusId
// import type { Report } from "@/types/report"; // Убедитесь, что этот тип обновлен или используйте локальный тип

// Если у вас нет отдельного файла types/report.ts, определите тип здесь:
interface Report {
	issueId: number;
	shortDescription: string;
	detailedDescription?: string;
	address: string;
	createdAt: string; // Или Date, в зависимости от того, как приходит с бэкенда
	expectedResolutionDate?: string; // Или Date
	statusName: string;
	typeName: string;
    statusId: number; // Добавляем statusId
    userName?: string | null; // Добавляем поля пользователя, если они приходят с бэкенда GET /reports
    userPoints?: number | null;
}


import {
	Table,
	TableBody,
	// TableCaption, // Удаляем неиспользуемый импорт
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

// Импортируем toast из sonner
import { toast } from "sonner";

// Импортируем компоненты для диалогового окна подтверждения удаления (опционально, но рекомендуется)
// import {
// 	AlertDialog,
// 	AlertDialogAction,
// 	AlertDialogCancel,
// 	AlertDialogContent,
// 	AlertDialogDescription,
// 	AlertDialogFooter,
// 	AlertDialogHeader,
// 	AlertDialogTitle,
// 	AlertDialogTrigger,
// } from "@/components/ui/alert-dialog";


export const DashboardReportsPanel = () => {
	const navigate = useNavigate();
	const [str, setStr] = useState("GreenMapper");
	// Используем useSWR для получения данных, ключ кэша - "/reports/"
	const { data: issues, error, isLoading } = useSWR<Report[]>("/reports/", fetcher);

	// Функция для удаления заявки
	const handleDelete = async (issueId: number) => {
		// Опционально: Добавить диалоговое окно подтверждения перед удалением
		// const confirmed = window.confirm(`Вы уверены, что хотите удалить заявку #${issueId}?`);
		// if (!confirmed) {
		// 	return;
		// }

		try {
			// Отправляем DELETE запрос на бэкенд
			// Создаем объект URL из строки, используя переменную окружения для базового URL
			const url = new URL(`/reports/${issueId}`);
			const response = await fetcher(url, {
				method: 'DELETE',
			});

			// Проверяем ответ бэкенда
			// Предполагаем, что успешный ответ содержит { success: true, ... }
			if (response && response.success) {
				console.log(`Заявка #${issueId} успешно удалена.`);
				// Обновляем данные в кэше SWR
				mutate("/reports/");
				// Показать уведомление об успешном удалении
				toast.success(`Заявка #${issueId} успешно удалена.`);
			} else {
                // Обрабатываем случай, когда ответ не содержит success: true или есть поле error
				console.error(`Ошибка при удалении заявки #${issueId}:`, response?.error || 'Неизвестная ошибка');
				// Показать уведомление об ошибке
				toast.error(`Ошибка при удалении заявки #${issueId}: ${response?.error || 'Неизвестная ошибка'}`);
			}
		} catch (err: any) { // Добавлено типизирование ошибки для доступа к message
			console.error(`Ошибка при выполнении DELETE запроса для заявки #${issueId}:`, err);
			// Показать уведомление об ошибке
			toast.error(`Ошибка при удалении заявки #${issueId}. ${err.message || 'Произошла ошибка сети.'}`);
		}
	};

	// Функция для изменения статуса заявки на "На рассмотрении" (statusId = 2)
	const handleStartReview = async (issueId: number) => {
		try {
			// Отправляем PUT запрос на бэкенд для изменения статуса
			// Создаем объект URL из строки, используя переменную окружения для базового URL
			const url = new URL(`reports/${issueId}/status`);
			const response = await fetcher(url, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ statusId: 2 }), // Устанавливаем statusId = 2
			});

            // Проверяем ответ бэкенда
            // Предполагаем, что успешный ответ содержит { success: true, ... }
			if (response && response.success) {
				console.log(`Статус заявки #${issueId} изменен на "На рассмотрении".`);
				// Обновляем данные в кэше SWR
				mutate("/reports/");
				// Показать уведомление об успешном изменении статуса
				toast.success(`Статус заявки #${issueId} изменен на "На рассмотрении".`);
			} else {
                 // Обрабатываем случай, когда ответ не содержит success: true или есть поле error
				console.error(`Ошибка при изменении статуса заявки #${issueId}:`, response?.error || 'Неизвестная ошибка');
				// Показать уведомление об ошибке
				toast.error(`Ошибка при изменении статуса заявки #${issueId}: ${response?.error || 'Неизвестная ошибка'}`);
			}
		} catch (err: any) { // Добавлено типизирование ошибки для доступа к message
			console.error(`Ошибка при выполнении PUT запроса для заявки #${issueId}/status:`, err);
			// Показать уведомление об ошибке
			toast.error(`Ошибка при изменении статуса заявки #${issueId}. ${err.message || 'Произошла ошибка сети.'}`);
		}
	};

	// Функция для кнопки "Подробнее" (пока ничего не делает)
	const handleDetails = (issueId: number) => {
		console.log(`Кнопка "Подробнее" нажата для заявки #${issueId}`);
		// Здесь можно добавить логику для перехода на страницу с подробной информацией о заявке
		// navigate(`/dashboard/reports/${issueId}`);

		// Показать уведомление о нажатии кнопки "Подробнее"
		toast.info(`Нажата кнопка "Подробнее" для заявки #${issueId}`);
	};


	if (isLoading) return <div>Загрузка заявок...</div>;
	if (error) return <div>Ошибка загрузки заявок: {error.message}</div>;
	if (!issues) return <div>Нет данных о заявках.</div>;


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
							<BreadcrumbPage>Панель управления заявками</BreadcrumbPage>
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
			<div className="flex flex-1 flex-col gap-4 p-4">
				<h1 className="text-xl font-bold">Панель управления заявками</h1>

				<div className="rounded-md border overflow-auto"> {/* Добавляем overflow-auto для горизонтального скролла */}
					<Table>
						{/* <TableCaption>Список всех заявок</TableCaption> */}
						<TableHeader>
							<TableRow>
								{/* Новые колонки для кнопок */}
								<TableHead className="w-[250px]">Действия</TableHead> {/* Увеличена ширина для кнопок */}
								{/* Оставшиеся поля */}
								<TableHead>ID</TableHead>
								<TableHead>Статус</TableHead>
								<TableHead>Короткое описание</TableHead>
								<TableHead>Дата создания</TableHead>
								<TableHead>Ожидаемая дата решения</TableHead>
                                {/* Убраны поля, которые больше не нужны в этом представлении */}
							</TableRow>
						</TableHeader>
						<TableBody>
							{issues.length > 0 ? (
								issues.map((issue) => (
									<TableRow key={issue.issueId}>
										{/* Ячейка с кнопками */}
										{/* Добавлен flex-wrap для переноса кнопок на новую строку, если не помещаются */}
										<TableCell className="flex flex-wrap gap-2">
											{/* Кнопка "Удалить" */}
											<Button
												variant="destructive" // Красный цвет для удаления
												size="sm"
												onClick={() => handleDelete(issue.issueId)}
											>
												Удалить
											</Button>
											{/* Кнопка "Начать рассмотрение" (отображаем только если статус != 2) */}
											{issue.statusId !== 2 && (
												<Button
													variant="secondary" // Серый цвет
													size="sm"
													onClick={() => handleStartReview(issue.issueId)}
												>
													Начать рассмотрение
												</Button>
											)}
                                            {/* Кнопка "Подробнее" */}
											<Button
												variant="outline" // Белый контур
												size="sm"
												onClick={() => handleDetails(issue.issueId)}
											>
												Подробнее
											</Button>
										</TableCell>
										{/* Оставшиеся ячейки данных */}
										<TableCell className="font-medium">{issue.issueId}</TableCell>
										<TableCell>{issue.statusName}</TableCell>
										<TableCell className="whitespace-normal break-words min-w-[200px]">{issue.shortDescription}</TableCell> {/* Добавлен min-w и перенос */}
										<TableCell>
											{issue.createdAt ? format(subHours(new Date(issue.createdAt), 0), "dd.MM.yyyy HH:mm", { locale: ru }) : 'Нет данных'}
										</TableCell>
										<TableCell>
											{issue.expectedResolutionDate ? format(new Date(issue.expectedResolutionDate), "dd.MM.yyyy HH:mm", { locale: ru }) : 'Нет данных'}
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={6} className="h-24 text-center">
										Нет заявок для отображения.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</>
	);
};
