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
import NotFound from "./pages/NotFound";
import Legal from "./pages/Legal";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import OwnerApply from "./pages/OwnerApply";

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
              <Route path="/terms"                     element={<Legal page="terms" />} />
              <Route path="/privacy"                   element={<Legal page="privacy" />} />
              <Route path="/cancellation-policy"       element={<Legal page="cancellation" />} />
              <Route path="/how-it-works"              element={<HowItWorks />} />
              <Route path="/about"                     element={<About />} />
              <Route path="/list-your-property"        element={<OwnerApply />} />
              <Route path="*"                          element={<NotFound />} />
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
