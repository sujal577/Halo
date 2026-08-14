import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import AuthForm from "./pages/auth/Auth";
import Dashboard from "./pages/dashboard/Dashboard";
import IsLogin from "./pages/auth/IsLogin";
import RoomCall from "./pages/room/RoomCall";

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />
      <Routes>
        <Route element={<IsLogin />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/room/:roomId" element={<RoomCall />} />
        </Route>
        <Route path="/signup" element={<AuthForm type="signup" />} />
        <Route path="/login" element={<AuthForm type="login" />} />
      </Routes>
    </Router>
  );
}

export default App;
