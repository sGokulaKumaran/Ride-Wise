// ============================================================
// 🦶 Footer — Site links + social + copyright
// ============================================================

export default function Footer({ tc }) {
  const columns = [
    { title: "Platform", items: ["Home", "Explore", "Create", "Marketplace"] },
    { title: "Creators", items: ["Live", "Earn", "Stories", "Community"] },
    { title: "Company", items: ["About", "Blog", "Careers", "Press"] },
    { title: "Legal", items: ["Privacy", "Terms", "Cookies", "Contact"] },
  ];

  return (
    <footer className={`border-t ${tc.divider} py-12 px-5 md:px-12`}>
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-bold mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.items.map((item) => (
                <li key={item}>
                  <a href="#" className={`text-sm ${tc.sub} hover:opacity-100 transition-colors`}>{item}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={`max-w-7xl mx-auto border-t ${tc.divider} pt-8 flex flex-col md:flex-row justify-between items-center gap-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tc.button}`}>
            <i className="fa fa-motorcycle text-sm"></i>
          </div>
          <p className={`text-sm ${tc.sub}`}>© 2024 RideWise. Made for riders.</p>
        </div>
        <div className="flex gap-3">
          {["fa-facebook", "fa-instagram", "fa-twitter", "fa-youtube"].map((icon) => (
            <a key={icon} href="#" className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.card} ${tc.cardHover}`}>
              <i className={`fa ${icon} text-sm`}></i>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
