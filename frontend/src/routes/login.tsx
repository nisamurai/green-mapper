import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

interface Fields {
	email: string;
	password: string;
}

const schema = z.object({
	email: z.string().email("Неправильный формат почты"),
	password: z.string().min(8, "Минимальная длина пароля: 8 символов"),
});

export const Login = () => {
	const [isPending, setIsPending] = useState(false);

	const form = useForm<Fields>({
		resolver: zodResolver(schema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const login = async ({ email, password }: Fields) => {
		setIsPending(true);
		const { error } = await authClient.signIn.email({
			email,
			password,
			callbackURL: "/dashboard",
		});
		setIsPending(false);

		if (error) {
			if (error?.code === "INVALID_EMAIL_OR_PASSWORD") toast("wrong creds");
			else toast("Ошибка");
		}
	};

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle>Войдите в аккаунт</CardTitle>
						<CardDescription>
							Введите вашу почту и пароль для входа
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(login)}
								className="flex flex-col gap-6"
							>
								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Почта</FormLabel>
											<FormControl>
												<Input placeholder="mail@example.ru" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<div className="flex items-center justify-between">
												<FormLabel>Пароль</FormLabel>
												<a
													href="#"
													className="text-sm underline-offset-4 hover:underline"
												>
													Забыли пароль?
												</a>
											</div>
											<FormControl>
												<Input type="password" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<Button disabled={isPending} type="submit" className="w-full">
									Войти
								</Button>
							</form>
							<Button className="w-full mt-4 bg-blue-600 text-white hover:bg-blue-700">
								Войти при помощи Госуслуг
							</Button>
						</Form>
						<div className="mt-4 text-center text-sm">
							Ещё нет аккаунта?{" "}
							<Link to="/auth/sign-up" className="underline underline-offset-4">
								Зарегистрироваться
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
