// ============================================================
// 🛣️ RideCard — Route card (trip planning + community reviews)
// Shows: Distance, time, difficulty, best bike, join CTA
// ============================================================

import { useNavigate } from "react-router-dom";

export default function RideCard({ ride, tc }) {
  const navigate = useNavigate();

  const difficultyStyles = {
    Easy:   "bg-green-500/20 text-green-400",
    Medium: "bg-yellow-500/20 text-yellow-400",
    Hard:   "bg-red-500/20 text-red-400",
  };

  return (
    <div className={`rounded-2xl overflow-hidden border ${tc.card} mb-6 transition-all hover:-translate-y-1 hover:shadow-2xl`}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${tc.badge}`}>
          🛣️ RIDE ROUTE
        </span>
        <span className={`text-xs ${tc.sub}`}>Community</span>
      </div>

      {/* Hero image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={ride.image}
          alt={ride.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        <h3 className="absolute bottom-3 left-4 right-4 text-white font-bold text-xl leading-tight">
          {ride.name}
        </h3>
      </div>

      {/* Stats grid */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div>
            <p className="font-black text-lg">{ride.distance}</p>
            <p className={`text-[10px] ${tc.sub}`}>Distance</p>
          </div>
          <div>
            <p className="font-black text-lg">{ride.duration}</p>
            <p className={`text-[10px] ${tc.sub}`}>Time</p>
          </div>
          <div>
            <p className="font-black text-lg">⭐ {ride.rating}</p>
            <p className={`text-[10px] ${tc.sub}`}>Rating</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${difficultyStyles[ride.difficulty] || difficultyStyles.Medium}`}>
              {ride.difficulty}
            </span>
            <p className={`text-[10px] ${tc.sub} mt-1`}>Level</p>
          </div>
        </div>

        {/* Best Bike Recommendation */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${tc.divider} mb-4`}>
          <i className="fa fa-motorcycle text-orange-500 text-lg shrink-0"></i>
          <div>
            <p className={`text-[10px] ${tc.sub}`}>Best bike for this ride</p>
            <p className="font-bold text-sm">{ride.bestBike}</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate(`/ride/${ride.name.toLowerCase().replace(/\s+/g, "-")}`)}
          className={`w-full py-3 rounded-full font-bold transition-all hover:scale-105 active:scale-95 ${tc.button}`}
        >
          <i className="fa fa-route mr-2"></i>
          View Full Route
        </button>
      </div>
    </div>
  );
}
