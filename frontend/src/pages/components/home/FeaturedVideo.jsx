// ============================================================
// 🎥 FeaturedVideo — Large cinematic featured video
// ============================================================

export default function FeaturedVideo({ tc }) {
  // 🔄 Replace with your own video later
  const featuredVid = "https://cdn.pixabay.com/video/2021/08/20/83358-588606416_large.mp4";

  return (
    <section className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bg}`}>
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— CINEMATIC —</p>
        <h2 className="text-3xl md:text-5xl font-black mb-2">🎥 Watch Riders</h2>
      </div>

      <div className={`relative rounded-3xl overflow-hidden border group ${tc.card}`}>
        <video 
          src={featuredVid} 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-1000" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
        
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform shadow-2xl">
            <i className="fa fa-play text-2xl text-black ml-1"></i>
          </button>
        </div>

        {/* Video info overlay */}
        <div className="absolute bottom-6 left-6 right-6">
          <span className={`inline-block px-3 py-1 mb-3 rounded-full text-xs font-bold ${tc.badge}`}>FEATURED</span>
          <h3 className="text-2xl md:text-4xl font-black text-white mb-2">My First 500KM Himalayan Ride</h3>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span>👤 @rider_arjun</span>
            <span>👁 24K views</span>
            <span>• 3 days ago</span>
          </div>
        </div>
      </div>
    </section>
  );
}
