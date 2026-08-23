// ============================================================
// 🛒 Marketplace — Buy and sell bikes & gear
// Filters, listing cards, sell CTA
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";

const FILTERS = ["All", "Sport", "Cruiser", "Adventure", "Classic", "Under ₹1L", "Under ₹2L", "Verified"];

const LISTINGS = [
  {
    id: "yamaha-r15-v4-2024",
    name: "Yamaha R15 V4 (2024)",
    price: "₹1,65,000",
    km: "5,200 km",
    year: 2024,
    location: "Chennai",
    category: "Sport",
    img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&q=80",
    verified: true,
  },
  {
    id: "ktm-duke-390-2023",
    name: "KTM Duke 390 (2023)",
    price: "₹2,75,000",
    km: "8,400 km",
    year: 2023,
    location: "Bangalore",
    category: "Sport",
    img: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=600&auto=format&q=80",
    verified: true,
  },
  {
    id: "royal-enfield-650-2022",
    name: "Royal Enfield 650 (2022)",
    price: "₹3,20,000",
    km: "12,000 km",
    year: 2022,
    location: "Mumbai",
    category: "Cruiser",
    img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&q=80",
    verified: false,
  },
  {
    id: "himalayan-450-2024",
    name: "Himalayan 450 (2024)",
    price: "₹2,95,000",
    km: "3,100 km",
    year: 2024,
    location: "Pune",
    category: "Adventure",
    img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=600&auto=format&q=80",
    verified: true,
  },
  {
    id: "honda-cb300r-2023",
    name: "Honda CB300R (2023)",
    price: "₹2,45,000",
    km: "6,800 km",
    year: 2023,
    location: "Hyderabad",
    category: "Naked",
    img: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600&auto=format&q=80",
    verified: true,
  },
  {
    id: "kawasaki-z900-2022",
    name: "Kawasaki Z900 (2022)",
    price: "₹8,50,000",
    km: "9,200 km",
    year: 2022,
    location: "Delhi",
    category: "Naked",
    img: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&auto=format&q=80",
    verified: false,
  },
];

export default function Marketplace() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("grid"); // grid | list

  const commandsMap = {
    dark:     () => setTheme("dark"),
    light:    () => setTheme("light"),
    warm:     () => setTheme("warm"),
    midnight: () => setTheme("midnight"),
    home:     () => navigate("/home"),
    sell:     () => navigate("/sell"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  const filtered = filter === "All" || filter === "Verified"
    ? filter === "Verified" ? LISTINGS.filter((l) => l.verified) : LISTINGS
    : LISTINGS.filter((l) => l.category.toLowerCase() === filter.toLowerCase());

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>

      {/* Mouse glow placeholder — kept minimal for performance */}
      <Sidebar tc={tc} />
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black">🛒 Marketplace</h1>
              <p className={`text-sm ${tc.sub} mt-1`}>
                {filtered.length} bikes from verified riders
              </p>
            </div>
            <div className="flex gap-2">
              {/* View toggle */}
              <div className={`flex rounded-full border ${tc.divider} p-1`}>
                <button
                  onClick={() => setView("grid")}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${view === "grid" ? tc.button : tc.sub}`}
                >
                  <i className="fa fa-grid-2 text-sm"></i>
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${view === "list" ? tc.button : tc.sub}`}
                >
                  <i className="fa fa-list text-sm"></i>
                </button>
              </div>
              <button
                onClick={() => navigate("/sell")}
                className={`px-5 py-2.5 rounded-full font-bold ${tc.button} hover:scale-105 active:scale-95 transition-transform`}
              >
                <i className="fa fa-plus mr-2"></i>Sell Yours
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div
            className="flex gap-2 mb-6 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap transition-all hover:scale-105 active:scale-95 ${
                  filter === f ? `${tc.button} border-transparent` : `${tc.card} ${tc.cardHover}`
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Listings */}
          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-4"
            }
          >
            {filtered.map((listing) => (
              <div
                key={listing.id}
                onClick={() => navigate(`/bike/${listing.id}`)}
                className={`rounded-2xl overflow-hidden border ${tc.card} hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer ${
                  view === "list" ? "flex gap-4" : ""
                }`}
              >
                {/* Image */}
                <div
                  className={`relative overflow-hidden ${
                    view === "list" ? "w-48 shrink-0" : "aspect-[4/3]"
                  }`}
                >
                  <img
                    src={listing.img}
                    alt={listing.name}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  {listing.verified && (
                    <span className="absolute top-2 left-2 px-2 py-1 bg-green-500 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                      <i className="fa fa-circle-check"></i> Verified
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex-1">
                  <h3 className="font-bold text-sm mb-1 truncate">{listing.name}</h3>
                  <p className="text-2xl font-black mb-2">{listing.price}</p>
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${tc.sub}`}>
                    <span>
                      <i className="fa fa-gauge mr-1"></i>{listing.km}
                    </span>
                    <span>
                      <i className="fa fa-calendar mr-1"></i>{listing.year}
                    </span>
                    <span>
                      <i className="fa fa-location-dot mr-1"></i>{listing.location}
                    </span>
                  </div>
                  {view === "list" && (
                    <button
                      className={`mt-3 px-4 py-2 rounded-full text-sm font-bold ${tc.button} hover:scale-105 transition-transform`}
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          <div className="text-center mt-8">
            <button
              className={`px-8 py-3 rounded-full border font-semibold transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}
            >
              <i className="fa fa-refresh mr-2"></i>Load More
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
