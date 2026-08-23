// ============================================================
// ✨ StoryRow — Stories at top of feed (Instagram-style)
// ============================================================

export default function StoryRow({ tc, stories = [] }) {
  // Default stories
  const defaultStories = [
    {
      user: "your_story",
      label: "Your Story",
      img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop",
      isYours: true,
    },
    {
      user: "@rider_arjun",
      label: "Arjun",
      img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    },
    {
      user: "@bike_lover",
      label: "Ravi",
      img: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
    },
    {
      user: "@adventure",
      label: "Priya",
      img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    },
    {
      user: "@mountain",
      label: "Karthik",
      img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&h=200&fit=crop",
    },
    {
      user: "@speed_rider",
      label: "Vikram",
      img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    },
    {
      user: "@moto_girl",
      label: "Sneha",
      img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
    },
  ];

  const items = stories.length ? stories : defaultStories;

  return (
    <div className={`rounded-2xl border ${tc.card} p-4 mb-6`}>
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((story, i) => (
          <button key={i} className="flex flex-col items-center gap-2 shrink-0 group">
            <div
              className={`relative w-16 h-16 rounded-full p-[3px] transition-transform group-hover:scale-110 ${
                story.isYours
                  ? "bg-gray-600"
                  : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500"
              }`}
            >
              <div
                className={`w-full h-full rounded-full overflow-hidden ${
                  story.isYours ? "" : "ring-2 ring-black"
                }`}
              >
                <img
                  src={story.img}
                  alt={story.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {story.isYours && (
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center">
                  <i className="fa fa-plus text-[9px] text-white"></i>
                </div>
              )}
            </div>
            <span className={`text-[10px] font-semibold max-w-[64px] truncate ${tc.text}`}>
              {story.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
