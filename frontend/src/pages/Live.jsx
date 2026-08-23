// ============================================================
// 🔴 Live — Live streaming page
// Shows active live streams with bike tags and viewer counts
// ============================================================

import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";

const LIVE_STREAMS = [
  { id: 1, user: "@rider_arjun",  title: "Spiti Valley Epic 🏔️",     viewers: 3240, bike: "Himalayan 450",   img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=800&auto=format&q=80", location: "Spiti Valley, HP" },
  { id: 2, user: "@night_raj",    title: "Mumbai Night Cruise 🌙",    viewers: 1204, bike: "Royal Enfield 650", img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&q=80", location: "Mumbai, MH" },
  { id: 3, user: "@speed_vikram", title: "Track Day at MMSC 🏁",      viewers: 890,  bike: "KTM RC390",        img: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=800&auto=format&q=80", location: "Chennai, TN" },
  { id: 4, user: "@mountain_priya", title: "Ladakh Sunrise Ride 🌅",   viewers: 2150, bike: "Himalayan 450",   img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&q=80", location: "Leh, Ladakh" },
  { id: 5, user: "@coastal_karthik", title: "ECR Beach Cruise 🏖️",    viewers: 560,  bike: "Yamaha R15",      img: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=800&auto=format&q=80", location: "Chennai, TN" },
  { id: 6, user: "@dawn_rider",   title: "Coorg Morning Mist ☁️",     viewers: 780,  bike: "RE Interceptor",  img: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&auto=format&q=80", location: "Coorg, KA" },
];

export default function Live() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();

  const commandsMap = {
    dark:  () => setTheme("dark"),  light: () => setTheme("light"),
    warm:  () => setTheme("warm"),  midnight: () => setTheme("midnight"),
    home:  () => navigate("/home"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} voiceMode={voiceMode} startVoice={startVoice} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                Live Rides
              </h1>
              <p className={`text-sm ${tc.sub} mt-1`}>{LIVE_STREAMS.length} riders streaming now</p>
            </div>
            <button className="px-5 py-2.5 rounded-full font-bold bg-red-500 text-white hover:bg-red-600 hover:scale-105 transition-all">
              <i className="fa fa-broadcast-tower mr-2"></i>Go Live
            </button>
          </div>

          {/* Featured stream */}
          <div
            className="relative rounded-2xl overflow-hidden mb-6 cursor-pointer group"
            onClick={() => {}}
          >
            <img
              src={LIVE_STREAMS[0].img}
              alt={LIVE_STREAMS[0].title}
              className="w-full h-64 md:h-96 object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full text-xs font-black text-white">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>LIVE
            </div>
            <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-bold rounded-full">
              👁 {LIVE_STREAMS[0].viewers.toLocaleString()} watching
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h2 className="text-2xl font-black">{LIVE_STREAMS[0].title}</h2>
              <p className="text-sm text-white/80 mt-1">
                {LIVE_STREAMS[0].user} · 🏍️ {LIVE_STREAMS[0].bike} · 📍 {LIVE_STREAMS[0].location}
              </p>
              <button className="mt-3 px-6 py-2.5 bg-red-500 rounded-full font-bold text-sm hover:bg-red-600 transition-colors">
                <i className="fa fa-play mr-2"></i>Join Stream
              </button>
            </div>
          </div>

          {/* Other streams grid */}
          <h2 className="text-xl font-black mb-4">More Live Streams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LIVE_STREAMS.slice(1).map((stream) => (
              <div
                key={stream.id}
                className={`rounded-2xl overflow-hidden border ${tc.card} hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer`}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img src={stream.img} alt={stream.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-red-500 rounded-full text-[10px] font-black text-white">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>LIVE
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] font-bold rounded-full">
                    👁 {stream.viewers.toLocaleString()}
                  </div>
                  <div className="absolute bottom-2 left-3 right-3 text-white">
                    <p className="font-bold text-sm truncate">{stream.title}</p>
                    <p className="text-[10px] text-white/70">{stream.user} · 🏍️ {stream.bike}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
