// ============================================================
// 👥 Community — Nearby riders + ride groups
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";

const NEARBY_RIDERS = [
  { id: 1, name: "Anbu Kumar",   bike: "Yamaha R15",      distance: "2.3 km", rides: 142, img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop", online: true  },
  { id: 2, name: "Vikram Singh", bike: "KTM Duke 390",    distance: "3.1 km", rides: 89,  img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop", online: true  },
  { id: 3, name: "Priya Sharma", bike: "RE Classic 350",  distance: "4.5 km", rides: 67,  img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", online: false },
  { id: 4, name: "Karthik R",    bike: "Kawasaki Ninja",  distance: "5.2 km", rides: 203, img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=200&h=200&fit=crop", online: true  },
  { id: 5, name: "Sneha M",      bike: "Yamaha MT-15",    distance: "6.8 km", rides: 55,  img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop", online: false },
  { id: 6, name: "Ravi Kumar",   bike: "Himalayan 450",   distance: "8.0 km", rides: 312, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", online: true  },
];

const GROUPS = [
  { id: 1, name: "Chennai Riders Club",    members: "12.4K", rides: 890, img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=300&auto=format&q=80", joined: false },
  { id: 2, name: "Spiti Adventure Riders", members: "8.2K",  rides: 234, img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&auto=format&q=80", joined: true  },
  { id: 3, name: "South India Tourers",    members: "5.1K",  rides: 156, img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=300&auto=format&q=80", joined: false },
  { id: 4, name: "Night Riders Chennai",   members: "3.8K",  rides: 445, img: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=300&auto=format&q=80", joined: false },
];

export default function Community() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [tab, setTab] = useState("nearby");
  const [groups, setGroups] = useState(GROUPS);

  const commandsMap = { dark: () => setTheme("dark"), light: () => setTheme("light"), warm: () => setTheme("warm"), midnight: () => setTheme("midnight"), home: () => navigate("/home") };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  const toggleJoin = (id) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, joined: !g.joined } : g));
  };

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} voiceMode={voiceMode} startVoice={startVoice} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-24 lg:pb-8">
        <div className="max-w-4xl mx-auto">

          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-black">👥 Community</h1>
            <p className={`text-sm ${tc.sub} mt-1`}>Connect with riders near you</p>
          </div>

          {/* Tabs */}
          <div className={`flex gap-1 p-1 rounded-full border ${tc.divider} mb-6 w-fit`}>
            {["nearby", "groups"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-full text-sm font-bold capitalize transition-all ${
                  tab === t ? `${tc.button}` : `${tc.sub} hover:bg-white/10`
                }`}
              >
                {t === "nearby" ? "📍 Nearby Riders" : "🏍️ Groups"}
              </button>
            ))}
          </div>

          {/* Nearby Riders */}
          {tab === "nearby" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {NEARBY_RIDERS.map((rider) => (
                <div key={rider.id} className={`rounded-2xl border ${tc.card} p-4 hover:shadow-xl hover:-translate-y-1 transition-all`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative shrink-0">
                      <img src={rider.img} alt={rider.name} className="w-14 h-14 rounded-full object-cover" loading="lazy" />
                      <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-current ${rider.online ? "bg-green-500" : "bg-gray-500"}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{rider.name}</p>
                      <p className={`text-xs ${tc.sub}`}>🏍️ {rider.bike}</p>
                      <p className={`text-xs ${tc.sub}`}>📍 {rider.distance} away · {rider.rides} rides</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className={`flex-1 py-2 rounded-full text-xs font-bold ${tc.button} hover:scale-105 transition-transform`}>
                      Connect
                    </button>
                    <button className={`flex-1 py-2 rounded-full text-xs font-bold border ${tc.card} ${tc.cardHover} transition-all`}>
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Groups */}
          {tab === "groups" && (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className={`rounded-2xl border ${tc.card} overflow-hidden hover:shadow-xl transition-all`}>
                  <div className="flex items-center gap-4 p-4">
                    <img src={group.img} alt={group.name} className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{group.name}</h3>
                      <p className={`text-xs ${tc.sub} mt-0.5`}>
                        👥 {group.members} members · 🛣️ {group.rides} rides
                      </p>
                    </div>
                    <button
                      onClick={() => toggleJoin(group.id)}
                      className={`px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 shrink-0 ${
                        group.joined
                          ? `border ${tc.divider} ${tc.sub}`
                          : tc.button
                      }`}
                    >
                      {group.joined ? "Joined ✓" : "Join"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
