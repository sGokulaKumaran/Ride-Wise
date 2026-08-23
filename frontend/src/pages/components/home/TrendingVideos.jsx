// ============================================================
// 🔥 TrendingVideos — 4-column video grid (YouTube-style)
// Data is hardcoded for now — replace with API later
// ============================================================

export default function TrendingVideos({ tc }) {
  // 🔄 REPLACE with your own images later
  const videos = [
    { 
      id: 1, 
      img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format", 
      title: "Night Ride Through Spiti Valley", 
      user: "@rider_arjun", 
      views: "24K", 
      duration: "12:34" 
    },
    { 
      id: 2, 
      img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format", 
      title: "R15 First Ride Reaction", 
      user: "@bike_lover", 
      views: "18K", 
      duration: "8:21" 
    },
    { 
      id: 3, 
      img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=600&auto=format", 
      title: "KTM Duke 390 Mountain Trip", 
      user: "@mountain_rider", 
      views: "12K", 
      duration: "15:48" 
    },
    { 
      id: 4, 
      img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format", 
      title: "Coastal Kerala 500km Ride", 
      user: "@adventure_rider", 
      views: "31K", 
      duration: "20:05" 
    },
  ];

  return (
    <section id="trending" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bgAlt}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— WHAT'S HOT —</p>
          <h2 className="text-3xl md:text-5xl font-black">🔥 Trending Now</h2>
        </div>
        <button className={`hidden md:block px-4 py-2 rounded-full border text-sm font-bold transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}>
          View All →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {videos.map((v) => (
          <div key={v.id} className={`group rounded-2xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={v.img} 
                alt={v.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <i className="fa fa-play-circle text-5xl text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all"></i>
              </div>
              <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm text-white text-xs font-bold rounded">
                {v.duration}
              </span>
            </div>
            <div className="p-4">
              <h3 className={`font-bold text-sm mb-2 line-clamp-2`}>{v.title}</h3>
              <div className={`flex items-center justify-between text-xs ${tc.sub}`}>
                <span>{v.user}</span>
                <span>👁 {v.views}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
