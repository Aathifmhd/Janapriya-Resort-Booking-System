import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';

// Public website
import SiteLayout from './site/SiteLayout';
import Home from './site/Home';
import Rooms from './site/Rooms';
import Dining from './site/Dining';
import Book from './site/Book';
import MyBooking from './site/MyBooking';
import Contact from './site/Contact';

// Staff portal
import AdminLayout from './admin/AdminLayout';
import Login from './admin/Login';
import Dashboard from './admin/Dashboard';
import Bookings from './admin/frontdesk/Bookings';
import Calendar from './admin/frontdesk/Calendar';
import RoomsAdmin from './admin/frontdesk/Rooms';
import RoomTypes from './admin/frontdesk/RoomTypes';
import Guests from './admin/frontdesk/Guests';
import Housekeeping from './admin/frontdesk/Housekeeping';
import Tables from './admin/restaurant/Tables';
import Orders from './admin/restaurant/Orders';
import Kitchen from './admin/restaurant/Kitchen';
import Menu from './admin/restaurant/Menu';
import Reservations from './admin/restaurant/Reservations';
import Inventory from './admin/inventory/Inventory';
import Purchases from './admin/inventory/Purchases';
import Suppliers from './admin/inventory/Suppliers';
import Movements from './admin/inventory/Movements';
import EmptyBottles from './admin/inventory/EmptyBottles';
import Employees from './admin/hr/Employees';
import Attendance from './admin/hr/Attendance';
import Leaves from './admin/hr/Leaves';
import Payroll from './admin/hr/Payroll';
import Invoices from './admin/finance/Invoices';
import Payments from './admin/finance/Payments';
import Expenses from './admin/finance/Expenses';
import Reports from './admin/finance/Reports';
import Settings from './admin/settings/Settings';
import Users from './admin/settings/Users';
import Audit from './admin/settings/Audit';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.startsWith('/admin') ? 'admin' : location.pathname}>
        <Route path="/" element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="dining" element={<Dining />} />
          <Route path="book" element={<Book />} />
          <Route path="my-booking" element={<MyBooking />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="rooms" element={<RoomsAdmin />} />
          <Route path="room-types" element={<RoomTypes />} />
          <Route path="guests" element={<Guests />} />
          <Route path="housekeeping" element={<Housekeeping />} />
          <Route path="tables" element={<Tables />} />
          <Route path="orders" element={<Orders />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="menu" element={<Menu />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="movements" element={<Movements />} />
          <Route path="empty-bottles" element={<EmptyBottles />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="payments" element={<Payments />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="audit" element={<Audit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
