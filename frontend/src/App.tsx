import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FieldPlacerPage from './pages/FieldPlacerPage';
import SendPage from './pages/SendPage';
import SigningPage from './pages/SigningPage';
import SuccessPage from './pages/SuccessPage';
import LoginPage from './pages/LoginPage';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Sender-only — gated behind the shared password */}
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/place/:id" element={<RequireAuth><FieldPlacerPage /></RequireAuth>} />
        <Route path="/send/:id" element={<RequireAuth><SendPage /></RequireAuth>} />

        {/* Recipient-facing — access is the unguessable token itself, no password */}
        <Route path="/sign/:token" element={<SigningPage />} />
        <Route path="/success" element={<SuccessPage />} />
      </Routes>
    </BrowserRouter>
  );
}
