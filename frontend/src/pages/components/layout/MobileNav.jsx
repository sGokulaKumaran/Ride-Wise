// ============================================================
// 📱 MobileNav — Bottom navigation (Instagram-style, mobile only)
// Shows on small screens, hidden on desktop
// ============================================================

export default function MobileNav({ tc }) {
  const items = [
    { icon: "fa-home",        label: "Home",   action: "top" },
    { icon: "fa-search",      label: "Search", action: "explore" },
    { icon: "fa-plus-square", label: "Create", action: "create" },
    { icon: "fa-shopping-bag",label: "Shop",   action: "shop" },
    { icon: "fa-user",        label: "Profile",action: "profile" },
  ];

  const scrollToSection = (id) => {
    if (id === "top") return window.scrollTo({ top: 0, behavior: "smooth" });
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t ${tc.divider} bg-black/80`}>
      <div className="flex justify-around items-center h-16 px-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => scrollToSection(item.action)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all hover:scale-110 ${tc.text}`}
          >
            <i className={`fa ${item.icon} text-xl`}></i>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
