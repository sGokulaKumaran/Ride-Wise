// ============================================================
// 🏍️ BikeDetailView — Full bike detail overlay/page
// Specs, reviews, related posts, buy/sell CTAs, find nearby riders
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_SPECS = [
  { label: "Engine",    value: "155cc Liquid-cooled" },
  { label: "Power",     value: "18.4 HP @ 10000 rpm" },
  { label: "Torque",    value: "14.2 Nm @ 7500 rpm"  },
  { label: "Mileage",   value: "40 kmpl"              },
  { label: "Weight",    value: "142 kg"               },
  { label: "Fuel Tank", value: "11 liters"            },
  { label: "Top Speed", value: "140 km/h"             },
  { label: "Braking",   value: "Dual Channel ABS"     },
];

const REVIEWS = [
  { user: "@arjun_k",  rating: 5, text: "Amazing bike for city + highway. Worth every rupee!", date: "2 days ago"  },
  { user: "@priya_r",  rating: 4, text: "Great mileage but seat comfort could be better for long rides.", date: "1 week ago" },
  { user: "@vikram_s", rating: 5, text: "Best in class performance. Love the handling.", date: "2 weeks ago" },
];

const RELATED_POSTS = [
  "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=300&auto=format&q=80",
  "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=300&auto=format&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&auto=format&q=80",
];

const TABS = ["specs", "reviews", "posts", "compare"];

export default function BikeDetailView({ bike, tc, onClose }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("specs");
  const specs = DEFAULT_SPECS.map((s) => ({
    ...s,
    value: bike[s.label.toLowerCase().replace(" ", "")] || s.value,
  }));

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${tc.bg} ${tc.text}`}>

      {/* Hero */}
      <div className="relative h-72 md:h-96 shrink-0">
        <img src={bike.image} alt={bike.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/50" />

        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform"
        >
          <i className="fa fa-arrow-left"></i>
        </button>

        <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform">
          <i className="far fa-bookmark"></i>
        </button>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-3xl md:text-5xl font-black text-white">{bike.name}</h1>
          <p className="text-white/60 mt-1 text-sm">
            {bike.brand}{bike.brand && " • "}{bike.category || "Motorcycle"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Price + CTA */}
        <div className={`rounded-2xl border ${tc.card} p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
          <div>
            <p className="text-4xl font-black">{bike.price}</p>
            <p className={`text-sm ${tc.sub} mt-1`}>⭐ {bike.rating} ({bike.reviews} reviews)</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => navigate("/marketplace")}
              className={`flex-1 md:flex-none px-6 py-3 rounded-full font-bold ${tc.button} hover:scale-105 transition-transform`}
            >
              <i className="fa fa-shopping-cart mr-2"></i>Buy Now
            </button>
            <button
              className={`px-6 py-3 rounded-full font-bold border ${tc.card} ${tc.cardHover} hover:scale-105 transition-transform`}
            >
              <i className="fa fa-tag mr-2"></i>Sell Yours
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-full border ${tc.divider} bg-black/20`}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-full text-sm font-bold capitalize transition-all ${
                activeTab === tab
                  ? `${tc.button} shadow-lg`
                  : `${tc.sub} hover:bg-white/10`
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Specs */}
        {activeTab === "specs" && (
          <div className={`rounded-2xl border ${tc.card} p-6`}>
            <h2 className="text-xl font-black mb-4">Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {specs.map((s) => (
                <div key={s.label} className={`flex justify-between py-3 border-b ${tc.divider}`}>
                  <span className={tc.sub}>{s.label}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === "reviews" && (
          <div className="space-y-3">
            <h2 className="text-xl font-black mb-2">Owner Reviews</h2>
            {REVIEWS.map((r, i) => (
              <div key={i} className={`rounded-2xl border ${tc.card} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold">{r.user}</p>
                  <span className="text-yellow-400">{"⭐".repeat(r.rating)}</span>
                </div>
                <p className={`text-sm ${tc.sub}`}>{r.text}</p>
                <p className={`text-xs ${tc.sub} mt-2`}>{r.date}</p>
              </div>
            ))}
          </div>
        )}

        {/* Posts */}
        {activeTab === "posts" && (
          <div>
            <h2 className="text-xl font-black mb-4">Posts Featuring This Bike</h2>
            <div className="grid grid-cols-3 gap-2">
              {RELATED_POSTS.map((src, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden">
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compare */}
        {activeTab === "compare" && (
          <div className={`rounded-2xl border ${tc.card} p-8 text-center`}>
            <i className={`fa fa-balance-scale text-5xl mb-4 ${tc.sub}`}></i>
            <p className={`${tc.sub} font-semibold`}>Bike comparison coming soon</p>
          </div>
        )}

        {/* Find Nearby Riders */}
        <div className={`rounded-2xl border ${tc.card} p-6`}>
          <h2 className="text-xl font-black mb-1">🏍️ Riders Near You With This Bike</h2>
          <p className={`text-sm ${tc.sub} mb-4`}>
            Connect with <strong>124 owners</strong> of {bike.name} in your area
          </p>
          <button
            className={`w-full py-3 rounded-full font-bold ${tc.button} hover:scale-105 transition-transform`}
          >
            <i className="fa fa-location-dot mr-2"></i>Find Riders Nearby
          </button>
        </div>
      </div>
    </div>
  );
}
