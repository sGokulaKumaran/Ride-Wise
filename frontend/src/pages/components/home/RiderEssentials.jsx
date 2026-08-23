// ============================================================
// 🛒 RiderEssentials — Product cards (Amazon-style shopping)
// ============================================================

export default function RiderEssentials({ tc }) {
  const items = [
    { id: 1, name: "Helmet MT Thunder 4", price: "₹4,999", rating: 4.6, img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&auto=format", cat: "Helmets" },
    { id: 2, name: "Racing Gloves Pro", price: "₹1,299", rating: 4.5, img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=400&auto=format", cat: "Gloves" },
    { id: 3, name: "Riding Jacket Xtreme", price: "₹6,499", rating: 4.8, img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=400&auto=format", cat: "Jackets" },
    { id: 4, name: "Phone Mount Holder", price: "₹899", rating: 4.3, img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format", cat: "Accessories" },
  ];

  return (
    <section id="shop" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bgAlt}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— GEAR UP —</p>
          <h2 className="text-3xl md:text-5xl font-black">🛒 Rider Essentials</h2>
        </div>
        <button className={`hidden md:block px-4 py-2 rounded-full border text-sm font-bold transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}>
          View Shop →
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((item) => (
          <div key={item.id} className={`group rounded-2xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-square overflow-hidden">
              <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <button className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 ${tc.card}`}>
                <i className="fa fa-heart text-xs"></i>
              </button>
            </div>
            <div className="p-4">
              <p className={`text-[10px] tracking-widest ${tc.sub} mb-1`}>{item.cat.toUpperCase()}</p>
              <h3 className="font-bold text-sm mb-2 line-clamp-1">{item.name}</h3>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{item.price}</span>
                <span className={`text-xs ${tc.sub}`}>⭐ {item.rating}</span>
              </div>
              <button className={`w-full mt-3 py-2 rounded-full text-sm font-bold border transition-all hover:scale-105 ${tc.card} ${tc.cardHover}`}>
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
