// ============================================================
// 📌 Sidebar — Left navigation (desktop only, hidden on mobile)
// Looks like Instagram/Facebook desktop layout
// ============================================================

import { useNavigate } from "react-router-dom";

export default function Sidebar({ tc }) {
  const navigate = useNavigate();

  // Menu items with icons + route targets
  const menuItems = [
    { icon: "fa-home",          label: "Home",         action: "top" },
    { icon: "fa-compass",       label: "Explore",      action: "explore" },
    { icon: "fa-bell",          label: "Notifications",badge: 3 },
    { icon: "fa-envelope",      label: "Messages",     badge: 5 },
    { icon: "fa-bookmark",      label: "Saved",        action: "saved" },
    { icon: "fa-shopping-cart", label: "Marketplace",  action: "shop" },
    { icon: "fa-trophy",        label: "Achievements", action: "achievements" },
    { icon: "fa-cog",           label: "Settings",     action: "settings" },
  ];

  // Scroll to section by ID
  const scrollToSection = (id) => {
    if (id === "top") return window.scrollTo({ top: 0, behavior: "smooth" });
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className={`hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 border-r ${tc.divider} bg-black/40 backdrop-blur-xl z-40`}>
      {/* Logo at top */}
      <div
        onClick={() => navigate("/")}
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:scale-105 transition-transform"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.button} text-sm`}>
          <i className="fa fa-motorcycle"></i>
        </div>
        <span className="text-xl font-black">
          Ride<span className="opacity-60">Wise</span>
        </span>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 mt-6 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.action && scrollToSection(item.action)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:bg-white/10 ${tc.text}`}
          >
            <i className={`fa ${item.icon} text-xl w-6 text-center`}></i>
            <span className="font-semibold flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Create Post Button */}
        <button className={`w-full mt-4 py-3 rounded-xl font-bold transition-all hover:scale-105 ${tc.button}`}>
          <i className="fa fa-plus mr-2"></i>
          Create Post
        </button>
      </nav>

      {/* Profile Section at bottom */}
      <div className={`p-3 rounded-2xl border ${tc.card} flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform`}>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white">
          R
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Rider Arjun</p>
          <p className={`text-xs ${tc.sub}`}>@rider_arjun</p>
        </div>
        <i className={`fa fa-ellipsis-h ${tc.sub}`}></i>
      </div>
    </aside>
  );
}
