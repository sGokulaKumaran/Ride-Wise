// ============================================================
// 👥 Suggestions — Right sidebar (Facebook-style, desktop only)
// Shows: Suggested riders, trending topics, online friends
// ============================================================

export default function Suggestions({ tc }) {
  const suggestions = [
    {
      user: "@rider_anbu",
      name: "Anbu Kumar",
      img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop",
    },
    {
      user: "@speed_vikram",
      name: "Vikram Singh",
      img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    },
    {
      user: "@mountain_priya",
      name: "Priya Sharma",
      img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    },
    {
      user: "@moto_karthik",
      name: "Karthik R",
      img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=100&h=100&fit=crop",
    },
  ];

  const trending = [
    { tag: "#SpitiValley2026", posts: "12K posts" },
    { tag: "#RoyalEnfield",    posts: "8.5K posts" },
    { tag: "#NightRide",       posts: "5.2K posts" },
    { tag: "#KTM390",          posts: "3.1K posts" },
    { tag: "#LehLadakh",       posts: "9.8K posts" },
  ];

  return (
    <aside
      className={`hidden xl:block fixed right-0 top-16 w-80 h-[calc(100vh-4rem)] p-5 border-l ${tc.divider} overflow-y-auto`}
      style={{ scrollbarWidth: "none" }}
    >
      {/* Suggested Riders */}
      <div className="mb-8">
        <h3 className={`font-bold mb-4 ${tc.sub} text-xs tracking-widest uppercase`}>
          Suggested For You
        </h3>
        <div className="space-y-4">
          {suggestions.map((s) => (
            <div key={s.user} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={s.img}
                  alt={s.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/30"
                  loading="lazy"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-current"></span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{s.user}</p>
                <p className={`text-xs ${tc.sub} truncate`}>{s.name}</p>
              </div>
              <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="mb-8">
        <h3 className={`font-bold mb-4 ${tc.sub} text-xs tracking-widest uppercase`}>
          Trending Now
        </h3>
        <div className="space-y-3">
          {trending.map((t, i) => (
            <div
              key={t.tag}
              className={`flex items-center gap-3 cursor-pointer p-2 rounded-xl transition-all ${tc.cardHover}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${tc.badge} shrink-0`}>
                {i + 1}
              </div>
              <div>
                <p className="font-bold text-sm">{t.tag}</p>
                <p className={`text-xs ${tc.sub}`}>{t.posts}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Online Now */}
      <div className="mb-8">
        <h3 className={`font-bold mb-4 ${tc.sub} text-xs tracking-widest uppercase`}>
          Online Now
        </h3>
        <div className="flex flex-wrap gap-3">
          {suggestions.map((s) => (
            <div key={s.user} className="relative cursor-pointer group">
              <img
                src={s.img}
                alt={s.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-green-500 group-hover:scale-110 transition-transform"
                loading="lazy"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-current"></span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={`text-xs ${tc.sub} space-y-1 pt-4 border-t ${tc.divider}`}>
        <p className="font-semibold">©2026 RideWise</p>
        <p className="opacity-70">Privacy · Terms · Cookies · About</p>
      </div>
    </aside>
  );
}
