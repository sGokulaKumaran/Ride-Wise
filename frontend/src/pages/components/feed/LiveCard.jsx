// ============================================================
// 🔴 LiveCard — Live streaming card with bike + viewer info
// ============================================================

export default function LiveCard({ live, tc }) {
  return (
    <div className={`rounded-2xl overflow-hidden border-2 border-red-500 ${tc.card} mb-6 transition-all hover:scale-[1.01] hover:shadow-2xl`}>
      <div className="relative aspect-video overflow-hidden">
        <img
          src={live.image}
          alt={live.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30"></div>

        {/* LIVE badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-full text-xs font-black text-white">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          LIVE
        </div>

        {/* Viewer count */}
        <div className="absolute top-3 right-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-bold rounded-full">
          👁 {live.viewers?.toLocaleString()}
        </div>

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <i className="fa fa-play text-white text-2xl ml-1"></i>
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <h3 className="font-bold text-lg leading-tight">{live.title}</h3>
          <p className="text-sm text-white/80 mt-0.5">
            {live.user} &bull; <i className="fa fa-motorcycle"></i> {live.bike}
          </p>
        </div>
      </div>

      {/* Join button */}
      <div className="p-4">
        <button className="w-full py-2.5 rounded-full font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors hover:scale-105 active:scale-95">
          <i className="fa fa-broadcast-tower mr-2"></i>
          Join Live
        </button>
      </div>
    </div>
  );
}
