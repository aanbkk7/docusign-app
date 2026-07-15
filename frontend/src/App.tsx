import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FieldPlacerPage from './pages/FieldPlacerPage';
import SendPage from './pages/SendPage';
import SigningPage from './pages/SigningPage';
import SuccessPage from './pages/SuccessPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/place/:id" element={<FieldPlacerPage />} />
        <Route path="/send/:id" element={<SendPage />} />
        <Route path="/sign/:token" element={<SigningPage />} />
        <Route path="/success" element={<SuccessPage />} />
      </Routes>
    </BrowserRouter>
  );
}
