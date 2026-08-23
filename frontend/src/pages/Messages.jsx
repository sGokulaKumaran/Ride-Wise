// ============================================================
// 💬 Messages — Direct messaging between riders
// ============================================================

import { useState, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import { useVoice } from "../components/shared/useVoice";
import { useNavigate } from "react-router-dom";

const CONVERSATIONS = [
  { id: 1, name: "Anbu Kumar",   bike: "R15",       img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop", lastMsg: "Are you joining the ride tomorrow?", time: "2m",  unread: 2, online: true  },
  { id: 2, name: "Vikram Singh", bike: "Duke 390",  img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", lastMsg: "That route was amazing! Let's do Coorg next.", time: "15m", unread: 0, online: true  },
  { id: 3, name: "Priya Sharma", bike: "RE 350",    img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", lastMsg: "Sent you the GPS route file 📍",   time: "1h",  unread: 1, online: false },
  { id: 4, name: "Karthik R",    bike: "Ninja 300", img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=100&h=100&fit=crop", lastMsg: "Good morning! Ready for the sunrise ride?", time: "3h",  unread: 0, online: false },
  { id: 5, name: "Sneha M",      bike: "Yamaha MT", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop", lastMsg: "Checked the weather, looks perfect this weekend!", time: "5h",  unread: 3, online: true  },
];

export default function Messages() {
  const msgIdRef = useRef(100);
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [activeChat, setActiveChat] = useState(CONVERSATIONS[0]);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { id: 1, from: "them", text: "Hey! Are you joining the ride tomorrow?",        time: "10:30 AM" },
    { id: 2, from: "me",   text: "Yes! Planning to leave by 5:30 AM from Tambaram.", time: "10:32 AM" },
    { id: 3, from: "them", text: "Perfect! I'll meet you there. My R15 just got serviced 🏍️", time: "10:33 AM" },
    { id: 4, from: "me",   text: "Nice! What's the route? Chennai → Mahabalipuram?", time: "10:35 AM" },
    { id: 5, from: "them", text: "Are you joining the ride tomorrow?",              time: "10:40 AM" },
  ]);

  const commandsMap = { dark: () => setTheme("dark"), light: () => setTheme("light"), warm: () => setTheme("warm"), midnight: () => setTheme("midnight"), home: () => navigate("/home") };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  const sendMessage = () => {
    if (!message.trim()) return;
    msgIdRef.current += 1;
    setChatMessages((prev) => [...prev, { id: msgIdRef.current, from: "me", text: message, time: "Now" }]);
    setMessage("");
  };

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} voiceMode={voiceMode} startVoice={startVoice} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-16 pb-16 lg:pb-0 h-screen flex flex-col">
        <div className="flex flex-1 overflow-hidden">

          {/* Conversation list */}
          <div className={`w-full md:w-80 shrink-0 border-r ${tc.divider} flex flex-col`} style={{ scrollbarWidth: "none" }}>
            <div className={`p-4 border-b ${tc.divider}`}>
              <h1 className="text-xl font-black mb-3">Messages</h1>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${tc.card}`}>
                <i className={`fa fa-search text-sm ${tc.sub}`}></i>
                <input type="text" placeholder="Search conversations..." className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {CONVERSATIONS.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveChat(conv)}
                  className={`w-full flex items-center gap-3 p-4 transition-all hover:bg-white/5 border-b ${tc.divider} ${activeChat.id === conv.id ? "bg-white/10" : ""}`}
                >
                  <div className="relative shrink-0">
                    <img src={conv.img} alt={conv.name} className="w-12 h-12 rounded-full object-cover" loading="lazy" />
                    {conv.online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-current"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-sm truncate">{conv.name}</p>
                      <span className={`text-[10px] ${tc.sub} shrink-0 ml-2`}>{conv.time}</span>
                    </div>
                    <p className={`text-xs ${tc.sub} truncate mt-0.5`}>{conv.lastMsg}</p>
                    <p className={`text-[10px] ${tc.sub} mt-0.5`}>🏍️ {conv.bike}</p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="shrink-0 w-5 h-5 bg-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {conv.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="hidden md:flex flex-1 flex-col">
            {/* Chat header */}
            <div className={`flex items-center gap-3 p-4 border-b ${tc.divider}`}>
              <div className="relative">
                <img src={activeChat.img} alt={activeChat.name} className="w-10 h-10 rounded-full object-cover" />
                {activeChat.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-current"></span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold">{activeChat.name}</p>
                <p className={`text-xs ${tc.sub}`}>🏍️ {activeChat.bike} · {activeChat.online ? "Online" : "Offline"}</p>
              </div>
              <div className="flex gap-2">
                <button className={`w-9 h-9 rounded-full flex items-center justify-center ${tc.cardHover} transition-colors`}>
                  <i className="fa fa-phone text-sm"></i>
                </button>
                <button className={`w-9 h-9 rounded-full flex items-center justify-center ${tc.cardHover} transition-colors`}>
                  <i className="fa fa-video text-sm"></i>
                </button>
                <button className={`w-9 h-9 rounded-full flex items-center justify-center ${tc.cardHover} transition-colors`}>
                  <i className="fa fa-ellipsis-h text-sm"></i>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "none" }}>
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                    msg.from === "me"
                      ? `${tc.button} rounded-br-sm`
                      : `${tc.card} rounded-bl-sm`
                  }`}>
                    <p>{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.from === "me" ? "text-white/60" : tc.sub}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className={`p-4 border-t ${tc.divider} flex items-center gap-3`}>
              <button className={`w-10 h-10 rounded-full flex items-center justify-center ${tc.cardHover} ${tc.sub} transition-colors`}>
                <i className="fa fa-image text-sm"></i>
              </button>
              <div className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full border ${tc.card}`}>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={`Message ${activeChat.name}...`}
                  className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
                />
                <button className={`w-8 h-8 rounded-full flex items-center justify-center ${tc.cardHover} ${tc.sub} transition-colors`}>
                  <i className="fa fa-microphone text-sm"></i>
                </button>
              </div>
              <button
                onClick={sendMessage}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${tc.button} hover:scale-110 transition-transform`}
              >
                <i className="fa fa-paper-plane text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
