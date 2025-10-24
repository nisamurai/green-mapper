import React, { useEffect, useState, useRef } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import { OSM } from "ol/source";
import { fromLonLat, toLonLat } from "ol/proj";
import { defaults as defaultControls, Zoom } from "ol/control";
import Overlay from "ol/Overlay";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Vector as VectorSource } from "ol/source";
import { Vector as VectorLayer } from "ol/layer";
import { Style, Icon } from "ol/style";
import { useNavigate } from "react-router";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

// Определите тип для заявки с учетом данных пользователя и типа
interface Report {
	issueId: number;
	latitude: string | null;
	longitude: string | null;
	shortDescription?: string;
	userName: string | null;
	userPoints: number | null;
	typeName: string | null; // Добавляем поле для типа заявки
}

function DarkMapSPB() {
	const [popupInfo, setPopupInfo] = useState<{
		coordinate: number[];
		pixel: number[];
		issue?: Report; // Поле для хранения данных о кликнутой заявке
	} | null>(null);
	const mapRef = useRef<Map | null>(null);
	const navigate = useNavigate();

	// Используем useRef для стабильных ссылок на источники и слои
	const issueMarkerSourceRef = useRef(new VectorSource());
	const issueMarkerLayerRef = useRef(new VectorLayer({
		source: issueMarkerSourceRef.current,
		style: new Style({
			image: new Icon({
				src: "/imgs/small-icon-label.png",
				anchor: [0.5, 1],
				crossOrigin: "anonymous",
			}),
		}),
	}));

	const tempMarkerSourceRef = useRef(new VectorSource());
	const tempMarkerLayerRef = useRef(new VectorLayer({
		source: tempMarkerSourceRef.current,
		style: new Style({
			image: new Icon({
				src: "/imgs/small-icon-label.png", // Можно использовать другую иконку
				anchor: [0.5, 1],
				crossOrigin: "anonymous",
			}),
		}),
	}));
	const mapContainerRef = useRef<HTMLDivElement>(null);

	// Загрузка данных о заявках с бэкенда
	const { data: issuesData, error: issuesError } = useSWR<Report[]>("/reports/", fetcher);

	// Основной эффект для инициализации карты.
	useEffect(() => {
		console.log("Map initialization effect running");

		let resizeObserver: ResizeObserver | null = null;
        let animationFrameId: number | null = null;

		// Функция для проверки размеров контейнера и инициализации карты с использованием requestAnimationFrame
		const checkDimensionsAndInitialize = () => {
            const currentMapTarget = mapContainerRef.current;
            if (!currentMapTarget) {
                 console.warn("#map element disappeared, stopping dimension check.");
                 return; // Элемент исчез, останавливаем проверку
            }

            const { clientWidth, clientHeight } = currentMapTarget;
            console.log(`Map target dimensions (raf check): ${clientWidth}x${clientHeight}`);

            if (clientWidth > 0 && clientHeight > 0) {
                console.log("Map target has dimensions, initializing map...");

                const extentSPB = [
                    ...fromLonLat([29.7, 59.7]),
                    ...fromLonLat([30.5, 60.1]),
                ];

                const map = new Map({
                    target: currentMapTarget,
                    layers: [
                        new TileLayer({
                            source: new OSM({ attributions: "", maxZoom: 19 }),
                        }),
                        issueMarkerLayerRef.current,
                        tempMarkerLayerRef.current,
                    ],
                    view: new View({
                        center: fromLonLat([30.3, 59.95]),
                        zoom: 10,
                        maxZoom: 20,
                        extent: extentSPB,
                    }),
                    controls: defaultControls({ zoom: new Zoom({ duration: 250 }) }),
                });

                mapRef.current = map;

                const popup = new Overlay({
                    element: document.getElementById("map-popup")!,
                    autoPan: true,
                    autoPanAnimation: { duration: 250 },
                });
                map.addOverlay(popup);

                map.updateSize();
                console.log("Initial map.updateSize() called after dimensions check.");


                // Обработчик клика по карте
                map.on("click", (event) => {
                    console.log("Map clicked");
                    const feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
                        return feature as Feature<Point>;
                    });

                    // Скрываем попап и очищаем временную метку при любом новом клике
                    setPopupInfo(null);
                    popup.setPosition(undefined);
                    tempMarkerSourceRef.current.clear();


                    if (feature) {
                        // Если клик был по существующей метке заявки
                        const clickedIssueId = feature.get('issueId');
                        // Находим полную информацию о заявке по ID из загруженных данных
                        const clickedIssue = issuesData?.find(issue => issue.issueId === clickedIssueId);

                        if (clickedIssue) {
                            const coordinate = (feature.getGeometry() as Point).getCoordinates();
                            const lonLat = toLonLat(coordinate);
                            // Устанавливаем информацию о кликнутой заявке для попапа
                            setPopupInfo({ coordinate: lonLat, pixel: event.pixel, issue: clickedIssue });
                            popup.setPosition(coordinate);
                        }

                    } else {
                        // Если клик был по пустой области карты
                        const coordinate = event.coordinate;
                        const lonLat = toLonLat(coordinate);

                        // Создаем новую временную метку и добавляем ее на слой временных меток
                        const tempMarker = new Feature({
                            geometry: new Point(coordinate),
                        });
                        tempMarkerSourceRef.current.addFeature(tempMarker);

                        // Устанавливаем информацию о координатах для создания новой заявки в попап
                        // Поле 'issue' отсутствует, что используется для определения типа попапа
                        setPopupInfo({ coordinate: lonLat, pixel: event.pixel });
                        popup.setPosition(coordinate);
                    }
                });

                // Обработчик изменения центра карты
                map.getView().on("change:center", () => {
                    const view = map.getView();
                    const center = view.getCenter();
                    if (!center) return;
                    const [minX, minY, maxX, maxY] = extentSPB;
                    let [x, y] = center;

                    if (x < minX) x = minX;
                    if (x > maxX) x = maxX;
                    if (y < minY) y = minY;
                    if (y > maxY) y = maxY;

                    if (x !== center[0] || y !== center[1]) {
                        view.setCenter([x, y]);
                    }
                });

                // После успешной инициализации карты начинаем наблюдение за изменениями размеров
                resizeObserver = new ResizeObserver(() => {
                    if (mapRef.current) {
                        console.log("Map container resized, updating map size");
                        mapRef.current.updateSize();
                    }
                });
                resizeObserver.observe(currentMapTarget);

                 // Очищаем запрос requestAnimationFrame после успешной инициализации
                if (animationFrameId !== null) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }


            } else {
                 // Размеры все еще нулевые, планируем следующую проверку на следующий кадр анимации
                 console.log("Map target has zero dimensions, requesting next animation frame...");
                 animationFrameId = requestAnimationFrame(checkDimensionsAndInitialize);
            }
        };

		if (!mapContainerRef.current) {
			console.error("Map target element #map not found!");
            requestAnimationFrame(() => {
                console.log("Retrying to find #map element...");
                checkDimensionsAndInitialize();
            });
			return;
		}

        // Начинаем процесс проверки размеров и инициализации
        checkDimensionsAndInitialize();


		// Функция очистки при размонтировании компонента
		return () => {
			console.log("Map cleanup running");
            // Отключаем наблюдателя и отменяем запрос requestAnimationFrame
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
            }

            // Удаляем карту, только если она была успешно создана
            if (mapRef.current) {
			    mapRef.current.setTarget(undefined);
			    mapRef.current = null;
            }
			issueMarkerSourceRef.current.clear();
			tempMarkerSourceRef.current.clear();
		};
    // Этот эффект должен запускаться когда обновляются завки
	}, [issuesData]);

	// Эффект для добавления ПЕРСИСТЕНТНЫХ меток при загрузке данных о заявках или их изменении
	useEffect(() => {
		console.log("Issues data effect running");
		if (issuesData) {
			issueMarkerSourceRef.current.clear();

			issuesData.forEach(issue => {
				if (issue.latitude && issue.longitude) {
					const latitude = parseFloat(issue.latitude);
					const longitude = parseFloat(issue.longitude);

					if (!isNaN(latitude) && !isNaN(longitude) && (latitude !== 0 || longitude !== 0)) {
						const coordinate = fromLonLat([longitude, latitude]);

						const marker = new Feature({
							geometry: new Point(coordinate),
							// Добавляем свойства к метке, включая данные пользователя и тип
							issueId: issue.issueId,
							shortDescription: issue.shortDescription,
							userName: issue.userName,
							userPoints: issue.userPoints,
							typeName: issue.typeName, // Добавляем тип заявки в свойства метки
						});

						issueMarkerSourceRef.current.addFeature(marker);
					}
				}
			});
		}
	}, [issuesData]); // Зависимости эффекта: issuesData

	// Обработчик кнопки "Создать заявку"
	const handleCreateReport = () => {
		// Проверяем, что popupInfo существует и не содержит информации о существующей заявке
		if (popupInfo && !popupInfo.issue) {
			const { coordinate } = popupInfo;

			navigate(
				`/dashboard/create-report?latitude=${coordinate[1]}&longitude=${coordinate[0]}`,
			);
		}
	};

	// Обработка ошибки загрузки заявок
	if (issuesError) {
		return <div>Ошибка загрузки заявок: {issuesError.message}</div>;
	}

	// Отображение загрузки заявок (опционально)
	if (!issuesData) {
		return <div>Загрузка заявок...</div>;
	}

	return (
		<div style={{ width: "100%", height: "100%", position: "relative" }}>
			{/* Элемент, куда будет рендериться карта OpenLayers */}
			<div id="map" ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

			{/* Попап для отображения информации о заявке или создания новой */}
			<div
				id="map-popup"
				className="ol-popup"
				style={{
					backgroundColor: "#333",
					color: "white",
					padding: "10px",
					borderRadius: "5px",
					border: "1px solid black",
					position: "absolute",
					bottom: "12px",
					left: "-50px",
                    // Увеличиваем ширину попапа
					width: "250px", // Увеличено с 200px до 250px (можно настроить)
					// Отображаем попап только если есть информация в popupInfo
					display: popupInfo ? 'block' : 'none'
				}}
			>
				{/* Проверяем, есть ли информация в popupInfo перед отображением содержимого */}
				{popupInfo && (
					<div>
						{popupInfo.issue ? (
							// Попап для отображения информации о существующей заявке
							<>
								<h4>Информация о заявке</h4>
								<p>ID заявки: {popupInfo.issue.issueId}</p>
                                {/* Добавляем отображение типа заявки с явным переносом строк */}
                                {/* Используем style={{ wordBreak: 'break-word' }} для переноса длинных слов */}
                                <p style={{ wordBreak: 'break-word' }}>Тип заявки: {popupInfo.issue.typeName || 'Неизвестно'}</p>
								<p style={{ wordBreak: 'break-word' }}>Описание: {popupInfo.issue.shortDescription || 'Нет описания'}</p>
								<p>Создатель: {popupInfo.issue.userName || 'Неизвестно'}</p>
								<p>Рейтинг создателя: {popupInfo.issue.userPoints !== null ? popupInfo.issue.userPoints : 'Нет данных'}</p>
								{/* Опционально: кнопка для перехода к полной информации о заявке */}
								{/* <button onClick={() => navigate(`/dashboard/reports/${popupInfo.issue.issueId}`)}>Подробнее</button> */}
							</>
						) : (
							// Попап для создания новой заявки (клик по пустой области)
							<>
								<h4>Создать новую заявку</h4>
								<p>
									Координаты:{" "}
									{popupInfo.coordinate.map((coord) => coord.toFixed(7)).join(", ")}
								</p>
								<button
									onClick={handleCreateReport}
									style={{
										backgroundColor: "#555",
										color: "white",
										border: "none",
										padding: "5px 10px",
										borderRadius: "3px",
										cursor: "pointer",
									}}
								>
									Создать заявку
								</button>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export default DarkMapSPB;