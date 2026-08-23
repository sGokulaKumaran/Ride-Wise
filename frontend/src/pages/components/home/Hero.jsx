// ============================================================
// 🎬 Hero — Cinematic fullscreen video with featured content
// Use online placeholder video (replace later)
// ============================================================

export default function Hero({ tc, scrollToSection }) {
  // 🔄 REPLACE with your own video: import heroVid from "@/assets/videos/hero.mp4";
  const heroVideo = "https://cdn.pixabay.com/video/2020/05/25/39881-426525416_large.mp4";

  return (
    <section className="relative -mt-8 w-full px-5 md:px-12">
      <div className="relative h-[70vh] md:h-[85vh] rounded-3xl overflow-hidden group">
        <video 
          src={heroVideo} 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent"></div>

        {/* Hero Text */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16">
          <span className={`inline-block w-fit px-3 py-1 mb-4 rounded-full text-xs font-bold tracking-widest ${tc.badge}`}>
            🏍️ FEATURED THIS WEEK
          </span>
          <h1 className="text-4xl md:text-7xl font-black leading-tight mb-4 max-w-3xl">
            Your Next<br />
            <span className={`bg-gradient-to-r ${tc.accent} bg-clip-text text-transparent`}>
              Ride Awaits
            </span>
          </h1>
          <p className={`text-base md:text-xl ${tc.sub} mb-6 max-w-2xl`}>
            Discover bikes, riders, and adventures from around the world.
          </p>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => scrollToSection("bikes")}
              className={`group px-6 py-3 rounded-full font-bold transition-all hover:scale-105 hover:shadow-2xl ${tc.button}`}
            >
              Explore Bikes
              <i className="fa fa-motorcycle ml-2 group-hover:rotate-12 transition-transform inline-block"></i>
            </button>
            <button 
              onClick={() => scrollToSection("trending")}
              className={`px-6 py-3 rounded-full font-bold border-2 transition-all hover:scale-105 ${tc.card} hover:bg-white/10`}
            >
              ▶ Watch Videos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
