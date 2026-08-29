// ============================================================
// 📱 MobileNav — Bottom navigation bar (mobile / tablet only)
// Instagram-style: 5 tabs with icons + labels
//
// ITEMS:
//   🏠 Home | 🔍 Find | 🏍️ (Start Ride CTA) | 💬 Messages | 👤 Profile
//
// ACTIVE STATE:
//   Orange colour on the active route's icon + label
//
// Start Ride button (center):
//   Slightly larger, gradient background — it's the most important action
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";

export default function MobileNav({ tc, onStartRide }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Nav items (excluding the center Start Ride CTA) ─────────
  const leftItems = [
    { icon: "fa-home",    label: "Home",    path: "/home"        },
    { icon: "fa-search",  label: "Find",    path: "/find-riders" },
  ];
  const rightItems = [
    { icon: "fa-comments", label: "Messages", path: "/messages" },
    { icon: "fa-user",     label: "Profile",  path: "/account"  },
  ];

  return (
    <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t ${tc.divider} bg-black/80`}>
      <div className="flex justify-around items-center h-16 px-1">

        {/* Left items */}
        {leftItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                isActive ? "text-orange-400" : tc.text
              }`}
            >
              <i className={`fa ${item.icon} text-xl`} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}

        {/* Center: Start Ride CTA (the most important action) */}
        <button
          onClick={onStartRide}
          className="flex flex-col items-center justify-center flex-shrink-0 -mt-5 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg shadow-orange-500/40 text-white transition-all hover:scale-110 active:scale-90"
          title="Start a Ride"
        >
          <i className="fa fa-motorcycle text-xl" />
        </button>

        {/* Right items */}
        {rightItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                isActive ? "text-orange-400" : tc.text
              }`}
            >
              <i className={`fa ${item.icon} text-xl`} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
