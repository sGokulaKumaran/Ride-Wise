// ============================================================
// 🏍️ BikeDetail — Full bike page (route: /bike/:id)
// Wraps BikeDetailView, pulls data from route params or mock
// ============================================================

import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import BikeDetailView from "../components/details/BikeDetailView";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";

// Mock bike data — replace with API call using useParams().id
const BIKE_DATA = {
  "yamaha-r15-v4": {
    name: "Yamaha R15 V4",
    brand: "Yamaha",
    category: "Sport",
    price: "₹1,82,000",
    rating: 4.7,
    reviews: 234,
    image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&auto=format&q=80",
  },
  "ktm-duke-390": {
    name: "KTM Duke 390",
    brand: "KTM",
    category: "Naked",
    price: "₹3,10,000",
    rating: 4.6,
    reviews: 412,
    image: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=1200&auto=format&q=80",
  },
  "himalayan-450": {
    name: "Himalayan 450",
    brand: "Royal Enfield",
    category: "Adventure",
    price: "₹2,85,000",
    rating: 4.8,
    reviews: 189,
    image: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=1200&auto=format&q=80",
  },
  "royal-enfield-hunter-350": {
    name: "Royal Enfield Hunter 350",
    brand: "Royal Enfield",
    category: "Classic",
    price: "₹1,49,000",
    rating: 4.5,
    reviews: 628,
    image: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&auto=format&q=80",
  },
};

export default function BikeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();

  const commandsMap = {
    dark:     () => setTheme("dark"),
    light:    () => setTheme("light"),
    warm:     () => setTheme("warm"),
    midnight: () => setTheme("midnight"),
    back:     () => navigate(-1),
    home:     () => navigate("/home"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  // Find bike by id param or use a fallback
  const bike = BIKE_DATA[id] || {
    name: id
      ?.split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    brand: "Unknown",
    category: "Motorcycle",
    price: "₹—",
    rating: 4.5,
    reviews: 0,
    image:
      "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&auto=format&q=80",
  };

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />
      <MobileNav tc={tc} />

      {/* BikeDetailView takes full screen */}
      <div className="lg:ml-64 pt-0">
        <BikeDetailView
          bike={bike}
          tc={tc}
          onClose={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
