// ============================================================
// 🛣️ PopularRides — Route cards with distance/difficulty
// ============================================================

export default function PopularRides({ tc }) {
  const rides = [
    { id: 1, name: "Chennai → Pondicherry", distance: "162 km", time: "3.5 hrs", rating: 4.6, difficulty: "Easy", img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=500&auto=format" },
    { id: 2, name: "Kodaikanal Loop", distance: "180 km", time: "5 hrs", rating: 4.8, difficulty: "Medium", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format" },
    { id: 3, name: "Ooty → Coonoor", distance: "85 km", time: "2.5 hrs", rating: 4.7, difficulty: "Easy", img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format" },
    { id: 4, name: "Kerala Coastal Ride", distance: "320 km", time: "8 hrs", rating: 4.9, difficulty: "Hard", img: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=500&auto=format" },
  ];

  // Helper: returns color class based on difficulty
  const difficultyColor = (level) => {
    if (level === "Easy") return "bg-green-500/20 text-green-400";
    if (level === "Medium") return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <section id="rides" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bgAlt}`}>
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— ADVENTURE STARTS HERE —</p>
        <h2 className="text-3xl md:text-5xl font-black mb-2">🛣️ Popular Rides</h2>
        <p className={`${tc.sub} text-sm`}>Routes loved by the community</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {rides.map((ride) => (
          <div key={ride.id} className={`group rounded-2xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-video overflow-hidden">
              <img src={ride.img} alt={ride.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              <h3 className="absolute bottom-3 left-3 right-3 text-white font-bold text-lg">{ride.name}</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold">{ride.distance}</div>
                  <div className={tc.sub}>Distance</div>
                </div>
                <div>
                  <div className="font-bold">{ride.time}</div>
                  <div className={tc.sub}>Time</div>
                </div>
                <div>
                  <div className="font-bold">⭐ {ride.rating}</div>
                  <div className={tc.sub}>Rating</div>
                </div>
              </div>
              <div className={`flex items-center justify-between mt-3 pt-3 border-t ${tc.divider}`}>
                <span className={`text-xs px-2 py-1 rounded-full ${difficultyColor(ride.difficulty)}`}>
                  {ride.difficulty}
                </span>
                <button className={`text-xs font-bold hover:underline`}>Explore →</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
