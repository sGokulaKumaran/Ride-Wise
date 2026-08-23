// ============================================================
// 🔴 LiveRides — Currently live streaming cards
// ============================================================

export default function LiveRides({ tc }) {
  const lives = [
    { id: 1, user: "@rider_x", title: "Chennai Night Ride", viewers: 1204, img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=600&auto=format" },
    { id: 2, user: "@mountain_rider", title: "Spiti Day 2", viewers: 856, img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format" },
  ];

  return (
    <section id="live" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bg}`}>
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— HAPPENING NOW —</p>
        <h2 className="text-3xl md:text-5xl font-black mb-2">
          🔴 <span className="text-red-500 animate-pulse">Live</span> Rides
        </h2>
        <p className={`${tc.sub} text-sm`}>Watch riders streaming right now</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lives.map((live) => (
          <div key={live.id} className={`group rounded-2xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-video overflow-hidden">
              <img src={live.img} alt={live.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <i className="fa fa-play-circle text-6xl text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all"></i>
              </div>
              <span className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full text-xs font-bold animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                LIVE
              </span>
              <span className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                👁 {live.viewers.toLocaleString()}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">{live.title}</h3>
                <p className={`text-xs ${tc.sub}`}>{live.user}</p>
              </div>
              <button className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-bold hover:scale-105 transition-transform">
                Watch Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
