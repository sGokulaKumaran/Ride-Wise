// ============================================================
// 🎬 StoryRow — DRides row at top of feed
// Custom name "DRides" for RideWise (bike-tagged ride stories)
// ============================================================

import DRideCard from "./DRideCard";

export default function StoryRow({ tc, drides = [], onOpenDRide }) {
  const yourDRide = {
    id: 0,
    title: "Your DRide",
    cover:
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop",
    isYours: true,
  };

  const items = [yourDRide, ...drides];

  return (
    <div className={`rounded-2xl border ${tc.card} p-4 mb-6`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-black text-base flex items-center gap-2">
          <span className="text-orange-500">⚡</span> DRides
        </h2>
        <button className={`text-xs font-semibold ${tc.sub} hover:underline`}>
          Watch all
        </button>
      </div>
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((dride) => (
          <DRideCard
            key={dride.id}
            dride={dride}
            tc={tc}
            onOpen={() => !dride.isYours && onOpenDRide && onOpenDRide(dride)}
          />
        ))}
      </div>
    </div>
  );
}
