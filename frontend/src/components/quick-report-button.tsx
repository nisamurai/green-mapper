import * as React from "react";
import { Camera } from "lucide-react";
import { useNavigate } from "react-router";
import { authClient } from "@/lib/auth";
import { FRONT_PATHS } from "@/types/paths";

export function QuickReportButton(
    props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
    const navigate = useNavigate();
    const { data: session } = authClient.useSession();
    const [isCameraOpen, setIsCameraOpen] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    /** После «ОК» вернуть на карту (нет геолокации). */
    const [redirectToMapOnDismiss, setRedirectToMapOnDismiss] = React.useState(false);
    const [capturedCoords, setCapturedCoords] = React.useState<{ latitude: string; longitude: string } | null>(null);
    const [isPressed, setIsPressed] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const requestGeolocation = async () => {
        if (!navigator.geolocation) {
            throw new Error("Геолокация в этом браузере недоступна.");
        }

        return new Promise<{ latitude: string; longitude: string }>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude.toString(),
                        longitude: position.coords.longitude.toString(),
                    });
                },
                (error) => reject(error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 30000,
                },
            );
        });
    };

    const openCamera = async () => {
        const isSecureOrigin = location.protocol === "https:" || location.hostname === "localhost";

        setErrorMessage(null);
        setRedirectToMapOnDismiss(false);
        setCapturedCoords(null);

        let cameraPromise: Promise<MediaStream> | null = null;
        if (isSecureOrigin) {
            cameraPromise = navigator.mediaDevices.getUserMedia({ video: true });
        } else {
            fileInputRef.current?.click();
        }

        try {
            if (cameraPromise) {
                const stream = await cameraPromise;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraOpen(true);
                }
            }
        } catch (error) {
            console.error("Ошибка при открытии камеры:", error);
            if (error instanceof DOMException && error.name === "NotAllowedError") {
                setErrorMessage(
                    "Доступ к камере был отклонён. Разрешите доступ и попробуйте снова.",
                );
            } else {
                setErrorMessage(
                    "Не удалось открыть камеру. Нажмите «ОК», чтобы вернуться на карту.",
                );
            }
            setRedirectToMapOnDismiss(true);
        }
    };

    const navigateToCreateReportWithPhoto = async (file: File) => {
        const path = "/app/dashboard/create-report";

        if (capturedCoords?.latitude && capturedCoords?.longitude) {
            navigate(path, {
                state: {
                    photo: file,
                    latitude: capturedCoords.latitude,
                    longitude: capturedCoords.longitude,
                },
            });
            return;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    navigate(path, {
                        state: {
                            photo: file,
                            latitude: lat,
                            longitude: lng,
                        },
                    });
                },
                (error) => {
                    console.error("Ошибка получения координат:", error);
                    setRedirectToMapOnDismiss(true);
                    setErrorMessage(
                        "Не удалось получить ваше местоположение. Разрешите доступ к геолокации в браузере. Нажмите «ОК», чтобы вернуться на карту.",
                    );
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 30000,
                },
            );
        } else {
            setRedirectToMapOnDismiss(true);
            setErrorMessage(
                "Геолокация в этом браузере недоступна. Нажмите «ОК», чтобы вернуться на карту.",
            );
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        navigateToCreateReportWithPhoto(file);
    };

    const closeCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const takePhoto = async () => {
        // Сначала получаем координаты
        let coords: { latitude: string; longitude: string } | null = null;
        try {
            coords = await requestGeolocation();
            setCapturedCoords(coords);
        } catch (error) {
            console.error("Ошибка получения координат:", error);
            // Продолжаем без координат - они загрузятся позже
        }

        // Затем делаем снимок
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                        closeCamera();
                        // Передаём координаты в state для навигации
                        if (coords) {
                            setCapturedCoords(coords);
                        }
                        navigateToCreateReportWithPhoto(file);
                    }
                }, 'image/jpeg');
            }
        }
    };

    const handleClick = () => {
        if (!session) {
            navigate('/auth/login');
            return;
        }
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 200);
        if (isCameraOpen) {
            closeCamera();
        } else {
            openCamera();
        }
    };

    return (
        <>
            <button
                type="button"
                {...props}
                onClick={handleClick}
                className={
                    "rounded-full bg-blue-600 px-3 py-3 focus:outline-none focus:ring-3 focus:ring-white " +
                    (isPressed ? "ring-4 ring-white " : "") +
                    (props.className ?? "")
                }
            >
                <Camera className="h-10 w-10" />
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
            />

            {errorMessage && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
                    <div className="max-w-sm rounded-lg bg-sidebar p-4 text-center">
                        <p className="text-sm font-medium text-sidebar-foreground">{errorMessage}</p>
                        <button
                            type="button"
                            onClick={() => {
                                const goMap = redirectToMapOnDismiss;
                                setErrorMessage(null);
                                setRedirectToMapOnDismiss(false);
                                if (goMap) {
                                    navigate(`/${FRONT_PATHS.APP}`);
                                }
                            }}
                            className="mt-3 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                            {redirectToMapOnDismiss ? "ОК" : "Закрыть"}
                        </button>
                    </div>
                </div>
            )}

            {isCameraOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="relative max-w-full max-h-full">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="max-w-full max-h-full rounded-lg"
                        />
                        <button
                            onClick={closeCamera}
                            className="absolute top-4 right-4 rounded-full bg-blue-600 p-2 text-white"
                        >
                            ✕
                        </button>
                        <button
                            onClick={takePhoto}
                            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-full bg-blue-600 p-3 text-white"
                        >
                            📸
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
