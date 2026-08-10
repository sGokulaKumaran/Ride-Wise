// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/landing-page/Landing";
import Login from "./pages/landing-page/Login";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
