import { Navigate, Route } from "react-router";
import { Routes } from "react-router";
import { ThemeProvider } from "./components/theme-provider";
import { SignUp } from "./routes/sign-up";
import { Login } from "./routes/login";
import { DashboardLayout } from "./components/dashboard-layout";
import { DashboardHome } from "./routes/dashboard/home";
import { Toaster } from "./components/ui/sonner";
import { DashboardReports } from "./routes/dashboard/reports";
import { DashboardCreateReport } from "./routes/dashboard/create-report";
import { DashboardReportsPanel } from "./routes/dashboard/reports-panel";
import { DashboardProfile } from "./routes/dashboard/profile";

function App() {
	return (
		<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
			<Routes>
				<Route index element={<Navigate to="/dashboard" replace />} />

				<Route path="auth">
					<Route path="login" element={<Login />} />
					<Route path="sign-up" element={<SignUp />} />
				</Route>

				<Route path="dashboard" element={<DashboardLayout />}>
					<Route index element={<DashboardHome />} />
					<Route path="profile" element={<DashboardProfile />} />
					<Route path="reports" element={<DashboardReports />} />
					<Route path="create-report" element={<DashboardCreateReport />} />
					<Route path="reports-panel" element={<DashboardReportsPanel />} />
				</Route>
			</Routes>
			<Toaster />
		</ThemeProvider>
	);
}

export default App;
