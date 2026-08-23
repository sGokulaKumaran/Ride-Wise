// ============================================================
// 🎬 DRideModal — Full-screen DRide viewer (story-like)
// Shows bike details, progress bar, bottom actions
// ============================================================

import { useState, useEffect } from "react";

export default function DRideModal({ dride, onClose, tc }) {
  const [progress, setProgress] = useState(0);

  // Auto-advance progress, close when done
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(onClose, 100);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => setProgress((p) => Math.min(p + 1, 100)), 50);
    return () => clearTimeout(timer);
  }, [progress, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onClick={onClose}
    >
      {/* Progress bar */}
      <div className="absolute top-2 left-3 right-3 h-1 bg-white/30 rounded-full overflow-hidden z-10">
        <div
          className="h-full bg-white rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div
        className="absolute top-6 left-4 right-4 flex items-center gap-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
          {dride.title?.charAt(0)?.toUpperCase() || "R"}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-white">{dride.title}</p>
          {dride.bike && (
            <p className="text-xs text-white/70">
              <i className="fa fa-motorcycle mr-1"></i>
              {dride.bike}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <i className="fa fa-times text-white"></i>
        </button>
      </div>

      {/* Full-screen image */}
      <div className="flex-1">
        <img
          src={dride.cover}
          alt={dride.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Bottom info bar */}
      <div
        className="absolute bottom-6 left-4 right-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-black/70 backdrop-blur-lg rounded-2xl p-4">
          <p className="text-white text-sm mb-3">
            {dride.bike && (
              <>
                <i className="fa fa-motorcycle mr-2 text-orange-400"></i>
                Riding on{" "}
                <strong className="ml-1 text-orange-300">{dride.bike}</strong>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button className="flex-1 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-transform">
              View Bike Details
            </button>
            <button className="px-5 py-2.5 bg-white/20 text-white rounded-full text-sm font-bold hover:bg-white/30 transition-colors">
              <i className="fa fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
