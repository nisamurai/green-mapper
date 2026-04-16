import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
// import type { Report } from "@/types/report"; // Этот тип здесь не нужен

// Импортируем toast из sonner
import { toast } from "sonner";
import { FRONT_PATHS } from "@/types/paths";

// Тип для типов проблем, получаемых с бэкенда
interface IssueType {
	typeId: number;
	name: string;
}

// Тип для данных, передаваемых через location.state
interface CreateReportState {
	photo?: File;
	latitude?: string | number;
	longitude?: string | number;
}

export const DashboardCreateReport = () => {
	const navigate = useNavigate();
	const location = useLocation();
	// Состояние для управления открытием выпадающего списка типов проблем
	const [open, setOpen] = React.useState(false);
	// Состояние для выбранного ID типа проблемы
	const [selectedIssueTypeId, setSelectedIssueTypeId] = React.useState<
		number | null
	>(null);

	// Загрузка типов проблем с бэкенда
	const { data: issueTypes, error: issueTypesError } = useSWR<IssueType[]>(
		"/reports/issue-types",
		fetcher,
	);

	// State for latitude and longitude
	const [latitude, setLatitude] = useState("");
	const [longitude, setLongitude] = useState("");
	// State for other form fields
	const [shortDescription, setShortDescription] = useState("");
	const [detailedDescription, setDetailedDescription] = useState("");
	const [address, setAddress] = useState("");
	const [file, setFile] = useState<File | null>(null); // Состояние для файла
	const [photoPreview, setPhotoPreview] = useState<string | null>(null); // Превью фото
	const [isFromQuickReport, setIsFromQuickReport] = useState(false); // Флаг быстрого отчёта
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Read coordinates from URL parameters and location.state on component mount
	useEffect(() => {
		// Приоритет 1: Данные из location.state (быстрый отчёт с фото)
		const state = location.state as CreateReportState | null;
		if (state) {
			if (state.latitude !== undefined) {
				setLatitude(String(state.latitude));
			}
			if (state.longitude !== undefined) {
				setLongitude(String(state.longitude));
			}
			if (state.photo) {
				setFile(state.photo);
				// Создаём превью для переданного фото
				const previewUrl = URL.createObjectURL(state.photo);
				setPhotoPreview(previewUrl);
				setIsFromQuickReport(true);
			}
			// Очищаем state после использования, чтобы при возврате не было проблем
			navigate(location.pathname + location.search, { replace: true });
			return;
		}

		// Приоритет 2: Координаты из URL параметров (клик по карте)
		const params = new URLSearchParams(location.search);
		const lat = params.get("latitude");
		const lon = params.get("longitude");

		if (lat) {
			setLatitude(lat);
		}
		if (lon) {
			setLongitude(lon);
		}
	}, [location.search, location.state, navigate]);

	// Очистка URL превью при размонтировании
	useEffect(() => {
		return () => {
			if (photoPreview) {
				URL.revokeObjectURL(photoPreview);
			}
		};
	}, [photoPreview]);

	// Function to clear all form fields
	const handleCancel = () => {
		setLatitude("");
		setLongitude("");
		setSelectedIssueTypeId(null); // Сбрасываем выбранный тип
		setShortDescription("");
		setDetailedDescription("");
		setAddress("");
		setFile(null);
		// Можно также перенаправить пользователя обратно на карту, если нужно
		// navigate(`/${FRONT_PATHS.APP}`);
	};

	// Function to handle form submission
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault(); // Предотвращаем стандартную отправку формы

		// Простая валидация
		if (
			!latitude ||
			!longitude ||
			selectedIssueTypeId === null ||
			!shortDescription ||
			!address
		) {
			// Обновленное многострочное сообщение об ошибке с использованием JSX и <br />
			toast.error(
				<div>
					Пожалуйста, заполните все обязательные поля:
					<br />- координаты [автоматически заполняются из карты],
					<br />- тип проблемы,
					<br />- краткое описание,
					<br />- адрес
				</div>,
			);
			return;
		}
		// Подготовка данных для отправки
		const reportData = {
			latitude: latitude,
			longitude: longitude,
			typeId: selectedIssueTypeId, // Отправляем ID типа проблемы
			shortDescription: shortDescription,
			detailedDescription: detailedDescription || undefined, // Отправляем undefined, если пустое
			address: address,
			// file: file, // Пока не отправляем файл
		};

		try {
			// Отправка данных на бэкенд с помощью fetcher
			// Предполагается, что fetcher уже парсит JSON и обрабатывает базовые ошибки HTTP
			const responseData = await fetcher("/reports/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(reportData),
			});

			// Проверяем, успешно ли создана заявка по наличию issueId в ответе
			if (responseData && responseData.issueId) {
				toast.success("Заявка успешно создана!");
				toast.success("Вам начислен +1 балл :)");
				// Перенаправляем пользователя на страницу со списком заявок
				navigate(`../${FRONT_PATHS.REPORTS}`);
			} else {
				// Если fetcher не выбросил ошибку, но issueId отсутствует,
				// возможно, fetcher возвращает объект ошибки или null при неудаче,
				// или структура успешного ответа изменилась.
				// В этом случае выводим общее сообщение об ошибке или сообщение из ответа, если оно есть.
				toast.error(
					`Ошибка при создании заявки: ${responseData?.error || "Неизвестная ошибка"}`,
				);
			}
		} catch (error) {
			console.error("Error submitting report:", error);
			// Обработка ошибок, выброшенных fetcher (например, сетевые ошибки или ошибки парсинга)
			toast.error(
				`Произошла ошибка при отправке заявки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
			);
		}
	};

	// Обработка ошибки загрузки типов проблем
	if (issueTypesError) {
		return <div>Ошибка загрузки типов проблем: {issueTypesError.message}</div>;
	}

	// Отображение загрузки типов проблем
	if (!issueTypes) {
		return <div>Загрузка типов проблем...</div>;
	}

	return (
		<>
			<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
				<Card className="w-full max-w-lg ">
					<CardHeader>
						<CardTitle>Создать заявку</CardTitle>
						<CardDescription>
							Заполните все пункты и отправьте заявку на рассмотрение
							администраторам
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit}>
							<div className="grid w-full items-center gap-4">
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="latitude">Широта</Label>
									<Input
										id="latitude"
										placeholder="Широта"
										value={latitude}
										onChange={(e) => setLatitude(e.target.value)}
										required
										disabled
									/>
								</div>
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="longitude">Долгота</Label>
									<Input
										id="longitude"
										placeholder="Долгота"
										value={longitude}
										onChange={(e) => setLongitude(e.target.value)}
										required
										disabled
									/>
								</div>
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="issueType">Тип проблемы</Label>

									<Popover open={open} onOpenChange={setOpen}>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												role="combobox"
												aria-expanded={open}
												className="justify-between w-full max-w-lg"
											>
												<span className="truncate w-100 text-left">
													{selectedIssueTypeId !== null
														? issueTypes.find(
																(type) => type.typeId === selectedIssueTypeId,
															)?.name
														: "Выберите тип проблемы..."}
												</span>
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="p-0 w-full max-w-100 whitespace-normal break-words">
											<Command>
												<CommandInput placeholder="Поиск проблемы..." />
												<CommandList>
													<CommandEmpty>Тип проблемы не найден</CommandEmpty>
													<CommandGroup>
														{issueTypes.map((type) => (
															<CommandItem
																key={type.typeId}
																value={type.name} // Используем name для поиска и отображения
																onSelect={() => {
																	// При выборе сохраняем typeId
																	setSelectedIssueTypeId(type.typeId);
																	setOpen(false);
																}}
																className="whitespace-normal wrap-anywhere"
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		selectedIssueTypeId === type.typeId
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																{type.name}
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								</div>
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="shortDescription">Короткое описание</Label>
									<Input
										className="w-full max-w-lg"
										id="shortDescription"
										placeholder="Кратко опишите суть проблемы"
										value={shortDescription}
										onChange={(e) => setShortDescription(e.target.value)}
										required
									/>
								</div>
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="detailedDescription">Полное описание</Label>
									<Textarea
										className="w-full max-w-lg wrap-anywhere"
										id="detailedDescription"
										placeholder="Подробно опишите проблему"
										value={detailedDescription}
										onChange={(e) => setDetailedDescription(e.target.value)}
										wrap="hard"
									/>
								</div>
								<div className="flex flex-col space-y-2.5 min-w-0">
									<Label htmlFor="address">Адрес</Label>
									<Input
										className="w-full max-w-lg"
										id="address"
										placeholder="Впишите адрес ближайшего объекта"
										value={address}
										onChange={(e) => setAddress(e.target.value)}
										required
									/>
								</div>
								<div className="grid w-full max-w-sm items-center gap-2.5 min-w-0">
									<Label htmlFor="picture">Фото</Label>
									{photoPreview ? (
										<div className="relative w-full">
											<img
												src={photoPreview}
												alt="Предпросмотр фото"
												className="w-full h-auto rounded-md border"
											/>
											{isFromQuickReport && (
												<p className="text-xs text-green-600 mt-1">
													✓ Фото загружено с камеры
												</p>
											)}
										</div>
									) : (
										<Input
											id="picture"
											type="file"
											accept="image/*"
											onChange={(e) =>
												setFile(e.target.files ? e.target.files[0] : null)
											}
										/>
									)}
								</div>
							</div>
						</form>
					</CardContent>
					<CardFooter className="flex justify-between">
						<Button variant="outline" onClick={handleCancel}>
							Отмена
						</Button>
						<Button type="submit" onClick={handleSubmit}>
							Отправить заявку
						</Button>
					</CardFooter>
				</Card>
			</div>
		</>
	);
};
