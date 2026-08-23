// ============================================================
// 🌄 RideStories — Long-form story cards
// ============================================================

export default function RideStories({ tc }) {
  const stories = [
    { id: 1, title: "Roads That Changed Me", author: "@rider_arjun", img: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&auto=format", readTime: "8 min read" },
    { id: 2, title: "My First Himalayan Adventure", author: "@bike_lover", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format", readTime: "12 min read" },
  ];

  return (
    <section id="stories" className={`w-full py-16 md:py-24 px-5 md:px-12 ${tc.bgAlt}`}>
      <div className="text-center mb-10">
        <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— LONG READS —</p>
        <h2 className="text-3xl md:text-5xl font-black mb-2">🌄 Ride Stories</h2>
        <p className={`${tc.sub} text-sm`}>Real experiences from real riders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {stories.map((story) => (
          <div key={story.id} className={`group rounded-3xl overflow-hidden border transition-all hover:-translate-y-2 hover:shadow-2xl cursor-pointer ${tc.card} ${tc.cardHover}`}>
            <div className="relative aspect-[16/9] overflow-hidden">
              <img src={story.img} alt={story.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
            </div>
            <div className="p-6">
              <p className={`text-xs tracking-widest ${tc.sub} mb-2`}>— {story.readTime.toUpperCase()} —</p>
              <h3 className="text-2xl font-black mb-2 group-hover:opacity-80">{story.title}</h3>
              <p className={`text-sm mb-4 ${tc.sub}`}>By {story.author}</p>
              <button className={`px-5 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 ${tc.button}`}>
                Read Story →
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
