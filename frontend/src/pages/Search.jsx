// ============================================================
// 🔍 Search — Search results across bikes, posts, riders, routes
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";

const CATEGORIES = ["All", "Bikes", "Riders", "Routes", "Posts", "Gear"];

const TRENDING_SEARCHES = [
  "#SpitiValley2026", "#RoyalEnfield650", "#NightRide", "#KTMDuke390",
  "#LehLadakh", "#YamahaR15", "#HimalayanAdventure", "#DailyCommuter",
];

const TRENDING_BIKES = [
  { name: "Himalayan 450",     img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=300&auto=format&q=80", price: "₹2.85L", id: "himalayan-450"      },
  { name: "KTM Duke 390",     img: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=300&auto=format&q=80", price: "₹3.10L", id: "ktm-duke-390"       },
  { name: "Yamaha R15 V4",    img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=300&auto=format&q=80", price: "₹1.82L", id: "yamaha-r15-v4"      },
  { name: "RE Hunter 350",    img: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=300&auto=format&q=80", price: "₹1.49L", id: "royal-enfield-hunter-350" },
];

export default function Search() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const commandsMap = { dark: () => setTheme("dark"), light: () => setTheme("light"), warm: () => setTheme("warm"), midnight: () => setTheme("midnight"), home: () => navigate("/home") };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} voiceMode={voiceMode} startVoice={startVoice} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-3xl mx-auto">

          {/* Search input */}
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border mb-6 ${tc.card}`}>
            <i className={`fa fa-search text-lg ${tc.sub}`}></i>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bikes, riders, routes, posts, gear..."
              className={`flex-1 bg-transparent outline-none text-base ${tc.text}`}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className={tc.sub}>
                <i className="fa fa-times"></i>
              </button>
            )}
            <button
              onClick={startVoice}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${voiceMode ? "bg-red-500 text-white animate-pulse" : tc.record}`}
            >
              <i className="fa fa-microphone text-sm"></i>
            </button>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto mb-6 pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap transition-all hover:scale-105 ${
                  category === cat ? `${tc.button} border-transparent` : `${tc.card} ${tc.cardHover}`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {!query ? (
            <>
              {/* Trending searches */}
              <div className="mb-8">
                <h2 className="text-lg font-black mb-4">🔥 Trending Searches</h2>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending bikes */}
              <div>
                <h2 className="text-lg font-black mb-4">🏍️ Trending Bikes</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TRENDING_BIKES.map((bike) => (
                    <div
                      key={bike.id}
                      onClick={() => navigate(`/bike/${bike.id}`)}
                      className={`rounded-2xl overflow-hidden border ${tc.card} hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer`}
                    >
                      <div className="aspect-square overflow-hidden">
                        <img src={bike.img} alt={bike.name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" loading="lazy" />
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-xs truncate">{bike.name}</p>
                        <p className="text-sm font-black mt-0.5">{bike.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={`rounded-2xl border ${tc.card} p-6 text-center`}>
              <i className={`fa fa-search text-4xl mb-3 ${tc.sub}`}></i>
              <p className="font-bold mb-1">Searching for &ldquo;{query}&rdquo;</p>
              <p className={`text-sm ${tc.sub}`}>Search results will appear here</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
