// ============================================================
// 🏍️ BikeCard — Marketplace product card (in feed)
// Click "View Bike" → goes to full BikeDetailView
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function BikeCard({ bike, tc }) {
  const navigate = useNavigate();
  const [wishlisted, setWishlisted] = useState(false);

  return (
    <div className={`rounded-2xl overflow-hidden border ${tc.card} mb-6 transition-all hover:-translate-y-1 hover:shadow-2xl`}>

      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${tc.badge}`}>
          🏍️ MARKETPLAC
        </span>
        <span className={`text-xs ${tc.sub}`}>Featured</span>
      </div>

      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-black/10">
        <img
          src={bike.image}
          alt={bike.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black ${tc.badge}`}>
          {bike.tag}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setWishlisted((w) => !w); }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 ${tc.card} ${wishlisted ? "text-red-500" : ""}`}
        >
          <i className={`${wishlisted ? "fas" : "far"} fa-heart`}></i>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-lg font-black mb-1">{bike.name}</h3>
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className={tc.sub}>⭐ {bike.rating} ({bike.reviews} reviews)</span>
          <span className={tc.sub}>•</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tc.badge}`}>
            {bike.category}
          </span>
        </div>

        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-2xl font-black">{bike.price}</p>
            <p className={`text-xs ${tc.sub} line-through`}>{bike.originalPrice}</p>
          </div>
          <span className="text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
            Save {bike.discount || "5%"}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/bike/${bike.name.toLowerCase().replace(/\s+/g, "-")}`)}
            className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95 ${tc.button}`}
          >
            View Bike Details
          </button>
          <button
            className={`px-4 py-2.5 rounded-full font-bold text-sm border transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}
          >
            <i className="far fa-bookmark"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
