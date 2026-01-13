import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail';
import SignIn from './components/SIgnIn'; 

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/" element={<Navigate to="/events" replace />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/signin" element={<SignIn />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;