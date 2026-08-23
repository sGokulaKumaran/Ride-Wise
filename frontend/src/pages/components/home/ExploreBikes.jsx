// ============================================================
// 🏍️ ExploreBikes — Filterable bike catalog (Amazon-style)
// Features: Category filter, hover effects, wishlist button
// State: activeCategory is local to this component
// ============================================================

import { useState } from "react";

export default function ExploreBikes({ tc }) {
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Sport", "Cruiser", "Adventure", "Naked", "Touring"];

  // 🔄 REPLACE these image URLs with your own imports
  const bikes = [
    { id: 1, name: "Yamaha R15 V4", price: "₹1,82,000", rating: 4.7, img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=500&auto=format", category: "Sport", tag: "BESTSELLER" },
    { id: 2, name: "Royal Enfield GT 650", price: "₹3,09,000", rating: 4.8, img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format", category: "Cruiser", tag: "TRENDING" },
    { id: 3, name: "KTM Duke 390", price: "₹3,10,000", rating: 4.6, img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=500&auto=format", category: "Naked", tag: "HOT" },
    { id: 4, name: "Himalayan 450", price: "₹2,85,000", rating: 4.9, img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format", category: "Adventure", tag: "NEW" },
    { id: 5, name: "Suzuki V-Strom 650", price: "₹8,80,000", rating: 4.7, img: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=500&auto=format", category: "Touring", tag: "PREMIUM" },
    { id: 6, name: "Bajaj Pulsar NS200", price: "₹1,49,000", rating: 4.4, img: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=500&auto=format", category: "Sport", tag: "VALUE" },
  ];

  // Filter logic — show all OR match category
  const filteredBikes = activeCategory === "All" 
    ? bikes 
    : bikes.filter(b => b.category === activeCategory);

  return (
    <section id="bikes" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bg}`}>
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— FIND YOUR PERFECT MATCH —</p>
        <h2 className="text-3xl md:text-5xl font-black mb-4">🏍️ Explore Bikes</h2>
        <p className={`${tc.sub} text-sm`}>From sports to adventure — we have it all</p>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-bold border transition-all hover:scale-105 ${
              activeCategory === cat
                ? `${tc.button} shadow-lg`
                : `${tc.card} ${tc.cardHover}`
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bike Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBikes.map((bike) => (
          <div key={bike.id} className={`group rounded-2xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-[4/3] overflow-hidden">
              <img src={bike.img} alt={bike.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black ${tc.badge}`}>
                {bike.tag}
              </span>
              <button className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 ${tc.card}`}>
                <i className="fa fa-heart text-sm"></i>
              </button>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-black mb-2">{bike.name}</h3>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs ${tc.sub}`}>⭐ {bike.rating}</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${tc.divider}`}>{bike.category}</span>
              </div>
              <p className="text-2xl font-black mb-4">{bike.price}</p>
              <button className={`w-full py-2.5 rounded-full font-bold transition-all hover:scale-105 ${tc.button}`}>
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state for filter */}
      {filteredBikes.length === 0 && (
        <p className={`text-center py-12 ${tc.sub}`}>No bikes in this category yet.</p>
      )}
    </section>
  );
}
