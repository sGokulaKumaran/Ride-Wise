// ============================================================
// TripPill.jsx — "you are driving BUS-01" on every page
//
// A vehicle trip keeps running (and keeps sending its position) whatever
// page is open — see DriverTripContext. This small floating pill makes
// that visible: wherever the driver wanders in the app, one tap brings
// them back to the trip's map, and they can never forget a trip is on.
//
// It is not shown on the full-screen map screens, which have their own
// way back and need the space.
// ============================================================

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useDriverTrip } from "../../../context/DriverTripContext";
import { useTheme } from "../../hooks/useTheme";
import Icon from "../ui/Icon";
import { LiveDot } from "./kit";
import { vehicleType } from "./fleetUi";
import { GPS } from "../../../services/locationService";
import { formatDistance } from "../../../services/routingApi";

const FULL_SCREEN = /^\/driver\/session$|^\/organizations\/[^/]+\/track\//;

export default function TripPill() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);
  const { trip, nav, gps } = useDriverTrip();
  const location = useLocation();
  const navigate = useNavigate();

  if (!trip || FULL_SCREEN.test(location.pathname)) return null;

  const gpsTrouble = gps.state === GPS.LOST || gps.state === GPS.DENIED || gps.state === GPS.UNSUPPORTED;
  const left = nav?.remainingDistance;

  return (
    <button
      type="button"
      onClick={() => navigate("/driver/session")}
      title="Back to the trip you are driving"
      className={`fixed bottom-[84px] left-4 z-[950] flex h-12 max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border pl-3.5 pr-4 text-left shadow-lg lg:bottom-6 lg:left-[17rem] ${tc.mapControl}`}
    >
      <LiveDot tone={gpsTrouble ? "danger" : "ok"} pulse={!gpsTrouble} />
      <Icon name={vehicleType(trip.vehicleType).icon} size={18} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold">Driving {trip.session.vehicleCode}</span>
        <span className={`truncate text-[11px] ${gpsTrouble ? tc.danger : tc.sub}`}>
          {gpsTrouble
            ? "No GPS — tap to check"
            : Number.isFinite(left) ? `${formatDistance(left)} left · tap to open` : "Tap to open the map"}
        </span>
      </span>
    </button>
  );
}
