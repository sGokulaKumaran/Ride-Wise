// ============================================================
// 📌 Sidebar — Left navigation for RideWise (custom features)
// Routes: Feed, Marketplace, Plan Ride, Live, Community, Saved, Messages
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar({ tc }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: "fa-home",            label: "Home Feed",   path: "/home"        },
    { icon: "fa-motorcycle",      label: "Marketplace", path: "/marketplace" },
    { icon: "fa-route",           label: "Plan Ride",   path: "/plan-ride"   },
    { icon: "fa-broadcast-tower", label: "Live",        path: "/live"        },
    { icon: "fa-users",           label: "Community",   path: "/community"   },
    { icon: "fa-bookmark",        label: "Saved",       path: "/saved"       },
    { icon: "fa-comments",        label: "Messages",    path: "/messages", badge: 3 },
  ];

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 border-r ${tc.divider} bg-black/40 backdrop-blur-xl z-40`}
    >
      {/* Logo */}
      <div
        onClick={() => navigate("/home")}
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:scale-105 transition-transform"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.button} text-sm`}
        >
          <i className="fa fa-motorcycle"></i>
        </div>
        <span className="text-xl font-black">
          Ride<span className="opacity-60">Wise</span>
        </span>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 mt-6 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:scale-[1.02] ${
                isActive
                  ? `${tc.button}`
                  : `hover:bg-white/10 ${tc.text}`
              }`}
            >
              <i className={`fa ${item.icon} text-xl w-6 text-center`}></i>
              <span className="font-semibold flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Share Ride CTA */}
        <button
          className={`w-full mt-4 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 ${tc.button}`}
        >
          <i className="fa fa-plus mr-2"></i>
          Share Ride
        </button>
      </nav>

      {/* Profile section at bottom */}
      <div
        className={`p-3 rounded-2xl border ${tc.card} flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform`}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
          R
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">Rider Arjun</p>
          <p className={`text-xs ${tc.sub}`}>@rider_arjun</p>
        </div>
        <i className={`fa fa-cog ${tc.sub} hover:rotate-90 transition-transform duration-300`}></i>
      </div>
    </aside>
  );
}
