import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Property from "./pages/Property";
import Booking from "./pages/Booking";
import BookingConfirm from "./pages/BookingConfirm";
import Saved from "./pages/Saved";
import Bookings from "./pages/Bookings";
import Profile from "./pages/Profile";
import OwnerLayout from "./pages/owner/OwnerLayout";
import AdminLayout from "./pages/admin/AdminLayout";
import BottomNav from "./components/BottomNav";

export default function App() {
  return (
    <Routes>
      {/* Guest portal */}
      <Route
        path="/*"
        element={
          <>
            <Routes>
              <Route path="/"                          element={<Home />} />
              <Route path="/search"                    element={<Search />} />
              <Route path="/property/:id"              element={<Property />} />
              <Route path="/booking/:id"               element={<Booking />} />
              <Route path="/booking-confirm/:bookingId" element={<BookingConfirm />} />
              <Route path="/saved"                     element={<Saved />} />
              <Route path="/bookings"                  element={<Bookings />} />
              <Route path="/profile"                   element={<Profile />} />
            </Routes>
            <BottomNav />
          </>
        }
      />

      {/* Owner portal — completely separate UI */}
      <Route path="/owner/*" element={<OwnerLayout />} />

      {/* Admin portal — founder only */}
      <Route path="/admin/*" element={<AdminLayout />} />
    </Routes>
  );
}
