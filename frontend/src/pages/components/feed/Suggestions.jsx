// ============================================================
// 👥 Suggestions — Right sidebar: Nearby Riders + Groups
// Custom for RideWise — geo-based rider discovery + groups
// ============================================================

export default function Suggestions({ tc }) {
  const nearbyRiders = [
    { name: "Anbu Kumar",   img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop", distance: "2.3 km", bike: "R15",      online: true  },
    { name: "Vikram Singh", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", distance: "3.1 km", bike: "Duke 390", online: true  },
    { name: "Priya Sharma", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", distance: "4.5 km", bike: "RE 350",   online: false },
    { name: "Karthik R",    img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=100&h=100&fit=crop", distance: "5.2 km", bike: "Ninja 300", online: true  },
  ];

  const groups = [
    { name: "Chennai Riders",       members: "12.4K", img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=100&h=100&fit=crop" },
    { name: "Spiti Adventure Club", members: "8.2K",  img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=100&h=100&fit=crop" },
    { name: "Daily Commuters",      members: "5.1K",  img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=100&h=100&fit=crop" },
  ];

  const trendingBikes = [
    "Royal Enfield 650",
    "KTM Duke 390",
    "Himalayan 450",
    "Yamaha R15 V4",
    "Honda CB300R",
  ];

  return (
    <aside
      className={`hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-4rem)] p-5 border-l ${tc.divider} overflow-y-auto`}
      style={{ scrollbarWidth: "none" }}
    >

      {/* Nearby Riders */}
      <div className="mb-7">
        <h3 className={`font-bold mb-4 text-xs tracking-widest uppercase ${tc.sub}`}>
          📍 Riders Near You
        </h3>
        <div className="space-y-3">
          {nearbyRiders.map((r) => (
            <div
              key={r.name}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${tc.cardHover}`}
            >
              <div className="relative shrink-0">
                <img
                  src={r.img}
                  alt={r.name}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-current ${
                    r.online ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{r.name}</p>
                <p className={`text-xs ${tc.sub}`}>
                  {r.distance} · 🏍️ {r.bike}
                </p>
              </div>
              <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Ride Groups */}
      <div className="mb-7">
        <h3 className={`font-bold mb-4 text-xs tracking-widest uppercase ${tc.sub}`}>
          🏍️ Ride Groups
        </h3>
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.name}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${tc.cardHover}`}
            >
              <img
                src={g.img}
                alt={g.name}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{g.name}</p>
                <p className={`text-xs ${tc.sub}`}>{g.members} members</p>
              </div>
              <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                Join
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Bikes */}
      <div className="mb-7">
        <h3 className={`font-bold mb-4 text-xs tracking-widest uppercase ${tc.sub}`}>
          🔥 Trending Bikes
        </h3>
        <div className="space-y-2">
          {trendingBikes.map((b, i) => (
            <div
              key={b}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${tc.cardHover}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${tc.badge} shrink-0`}>
                {i + 1}
              </div>
              <p className="text-sm font-semibold">🏍️ {b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={`pt-4 border-t ${tc.divider} text-xs ${tc.sub} space-y-1`}>
        <p className="font-semibold">©2026 RideWise</p>
        <p className="opacity-70">Privacy · Terms · Safety · About</p>
      </div>
    </aside>
  );
}
