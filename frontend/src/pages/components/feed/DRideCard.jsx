// ============================================================
// 🎬 DRideCard — "DRides" story-style card for RideWise
// Each DRide is a bike-tagged ride experience story
// ============================================================

export default function DRideCard({ dride, tc, onOpen }) {
  return (
    <button
      onClick={() => onOpen && onOpen(dride)}
      className="flex flex-col items-center gap-2 shrink-0 group"
    >
      {/* Gradient ring — orange/red/purple if unviewed, gray if viewed */}
      <div
        className={`relative w-16 h-16 rounded-full p-[3px] transition-transform group-hover:scale-110 ${
          dride.isYours
            ? "bg-gray-600"
            : dride.viewed
            ? "bg-gray-500"
            : "bg-gradient-to-tr from-orange-500 via-red-500 to-purple-500"
        }`}
      >
        <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-black">
          <img
            src={dride.cover}
            alt={dride.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Bike icon badge */}
        {dride.bike && !dride.isYours && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border-2 border-black flex items-center justify-center">
            <i className="fa fa-motorcycle text-[9px] text-black"></i>
          </div>
        )}

        {/* Add button for your story */}
        {dride.isYours && (
          <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center">
            <i className="fa fa-plus text-[9px] text-white"></i>
          </div>
        )}
      </div>

      <span className={`text-[10px] font-semibold max-w-[64px] truncate ${tc.text}`}>
        {dride.title}
      </span>
    </button>
  );
}
