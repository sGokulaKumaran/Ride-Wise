// ============================================================
// 📱 MobileNav — Bottom navigation (Instagram-style, mobile only)
// RideWise-specific routes
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";

export default function MobileNav({ tc }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: "fa-home",            label: "Feed",      path: "/home"        },
    { icon: "fa-search",          label: "Search",    path: "/search"      },
    { icon: "fa-plus-circle",     label: "Share",     path: "/share"       },
    { icon: "fa-motorcycle",      label: "Market",    path: "/marketplace" },
    { icon: "fa-user",            label: "Profile",   path: "/profile"     },
  ];

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t ${tc.divider} bg-black/80`}
    >
      <div className="flex justify-around items-center h-16 px-2">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all hover:scale-110 ${
                isActive ? "text-orange-400" : tc.text
              }`}
            >
              <i
                className={`fa ${item.icon} text-xl ${
                  item.label === "Share" ? "text-2xl" : ""
                }`}
              ></i>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
