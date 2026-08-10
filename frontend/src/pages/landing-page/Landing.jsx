import "./Landing.css";

import introBike from "@/assets/videos/bikebgm.mp4";
import mounbgm from "@/assets/videos/mounbgm.mp4";

import bike1 from "@/assets/images/bike1.png";
import biker1 from "@/assets/images/biker1.jpg";
import biker2 from "@/assets/images/biker2.png";
import biker3 from "@/assets/images/biker3.jpg";
import mountain from "@/assets/images/mountain.png";
import sketchbike from "@/assets/images/sketchbike.png";

// 🛠️ Reusable Hover Effects
const Section = ({ children, className = "" }) => (
  <section className={`w-full py-20 md:py-28 px-6 md:px-16 ${className}`}>
    {children}
  </section>
);

function Landing() {
  return (
    <div className="bg-black text-white overflow-x-hidden font-sans">
      
      {/* ================= NAVBAR ================= */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 md:px-16 py-5 bg-black/70 backdrop-blur-md border-b border-white/10">
        <div className="text-2xl md:text-3xl font-bold flex items-center gap-3 hover:scale-105 transition-transform duration-300 cursor-pointer">
          <i className="fa fa-motorcycle text-white"></i>
          <span className="hover:text-gray-300 transition-colors">RideWise</span>
        </div>
        
        <nav className="hidden md:flex gap-8 items-center">
          {["Home", "Explore", "Create", "Marketplace", "Live"].map((item, i) => (
            <a
              key={i}
              href="#"
              className="relative text-white font-medium hover:text-gray-300 transition-colors duration-300 group"
            >
              {item}
              <span className="absolute left-0 -bottom-1 w-0 h-0.5 bg-white group-hover:w-full transition-all duration-300"></span>
            </a>
          ))}
        </nav>

        <div className="flex gap-3 items-center">
          <button className="px-5 py-2 border border-white/40 rounded-full hover:bg-white hover:text-black transition-all duration-300 hover:scale-105">
            Login
          </button>
          <button className="px-5 py-2 bg-white text-black rounded-full font-bold hover:scale-105 hover:shadow-2xl hover:shadow-white/20 transition-all duration-300">
            Join Free
          </button>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <Section className="relative h-screen flex flex-col justify-center items-center text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            src={introBike}
            autoPlay
            loop
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>
        </div>

        {/* Animated Particles */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random() * 0.5 + 0.2
              }}
            ></div>
          ))}
        </div>

        <div className="relative z-20 max-w-5xl">
          <div className="inline-block px-4 py-2 mb-6 border border-white/30 rounded-full text-sm tracking-widest backdrop-blur-md hover:border-white/60 transition-colors duration-300">
            🚀 #1 RIDER CREATOR PLATFORM
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-6 animate-fadeIn">
            Share Your Ride.
            <br />
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              Earn From Your Journey
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Join 5,000+ riders turning passion into content and content into income. 
            <br className="hidden md:block" />
            <span className="text-white font-semibold">Post • Stream • Earn • Sell</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="group px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300">
              Join Community
              <i className="fa fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
            </button>
            <button className="px-8 py-4 border-2 border-white/50 text-white font-bold rounded-full hover:bg-white hover:text-black hover:scale-105 transition-all duration-300">
              Start Posting
            </button>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm">
            {["✔ Post Your Ride", "✔ Tag Your Bike", "✔ Earn Credits", "✔ Convert to Money"].map((item, i) => (
              <span key={i} className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full hover:bg-white/10 hover:scale-105 transition-all duration-300 cursor-pointer">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white rounded-full"></div>
          </div>
        </div>
      </Section>

      {/* ================= ABOUT ================= */}
      <Section className="bg-black">
        <div className="text-center mb-20">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— ABOUT RIDEWISE —</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Where Riders <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Create, Share & Earn</span>
          </h2>
          <div className="w-20 h-1 bg-white mx-auto rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="group relative overflow-hidden rounded-2xl hover:scale-[1.02] transition-transform duration-500">
            <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-gray-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img
              src={sketchbike}
              alt="Bike"
              className="relative w-full h-auto rounded-2xl group-hover:scale-105 transition-transform duration-700"
            />
          </div>

          <div className="space-y-6">
            <p className="text-gray-300 text-lg leading-relaxed">
              RideWise is a <span className="text-white font-bold">rider-powered social platform</span> where creators share their journeys, showcase their bikes, and earn real income from their content.
            </p>

            <div className="grid grid-cols-3 gap-4">
              {[
                { num: "10K+", label: "Posts" },
                { num: "5K+", label: "Riders" },
                { num: "1M+", label: "Views" }
              ].map((stat, i) => (
                <div key={i} className="text-center p-5 border border-white/10 rounded-2xl hover:border-white/40 hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                  <div className="text-3xl font-black text-white">{stat.num}</div>
                  <div className="text-xs text-gray-400 mt-1 tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "fa-mobile", label: "Social Feed" },
                { icon: "fa-video-camera", label: "Live Stream" },
                { icon: "fa-tag", label: "Bike Tagging" },
                { icon: "fa-coins", label: "Earn Credits" },
                { icon: "fa-shopping-cart", label: "Marketplace" },
                { icon: "fa-users", label: "Community" }
              ].map((f, i) => (
                <div key={i} className="group flex items-center gap-3 p-4 border border-white/10 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all duration-300 cursor-pointer">
                  <i className={`fa ${f.icon} text-white text-lg group-hover:scale-125 transition-transform duration-300`}></i>
                  <span className="text-sm font-semibold">{f.label}</span>
                </div>
              ))}
            </div>

            <button className="group px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300">
              Learn More
              <i className="fa fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
            </button>
          </div>
        </div>
      </Section>

      {/* ================= MISSION ================= */}
      <Section className="relative h-screen flex flex-col justify-center items-center overflow-hidden">
        <video
          src={mounbgm}
          autoPlay
          loop
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>

        <div className="relative z-10 text-center max-w-4xl">
          <p className="text-sm tracking-widest text-gray-300 mb-4">— OUR MISSION —</p>
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
            Every Ride is Content.
            <br />
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Every Creator Earns.
            </span>
          </h1>

          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 mb-10">
            {["Create", "Share", "Grow", "Earn"].map((step, i) => (
              <span key={i} className="flex items-center gap-3 md:gap-4">
                <span className="px-5 py-2 border border-white/40 rounded-full font-bold hover:bg-white hover:text-black hover:scale-110 transition-all duration-300 cursor-pointer">
                  {step}
                </span>
                {i < 3 && <span className="text-2xl">→</span>}
              </span>
            ))}
          </div>

          <p className="text-lg md:text-xl text-gray-200 mb-10">
            We empower riders to <span className="text-white font-semibold">build audiences</span>, 
            <span className="text-white font-semibold"> monetize passion</span>, and 
            <span className="text-white font-semibold"> connect globally</span>.
          </p>

          <button className="group px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-110 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300">
            Start Your Journey
            <i className="fa fa-motorcycle ml-2 group-hover:rotate-12 transition-transform inline-block"></i>
          </button>
        </div>
      </Section>

      {/* ================= PLATFORM FEATURES ================= */}
      <Section className="bg-black">
        <div className="text-center mb-20">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— PLATFORM FEATURES —</p>
          <h2 className="text-4xl md:text-6xl font-black mb-4">
            Everything You Need to <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Ride & Earn</span>
          </h2>
          <div className="w-20 h-1 bg-white mx-auto rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "Post Your Journey", icon: "fa-camera", desc: "Share photos and videos from your rides" },
            { title: "Live Streaming", icon: "fa-broadcast-tower", desc: "Go live and interact with viewers" },
            { title: "Bike Tagging", icon: "fa-tag", desc: "Tag your bike on every post" },
            { title: "Earn Credits", icon: "fa-coins", desc: "Get credits for engagement" },
            { title: "Marketplace", icon: "fa-shopping-cart", desc: "Buy and sell bikes" },
            { title: "Rider Community", icon: "fa-users", desc: "Connect with riders worldwide" }
          ].map((f, i) => (
            <div
              key={i}
              className="group relative p-8 border border-white/10 rounded-2xl hover:border-white/40 hover:-translate-y-2 transition-all duration-500 overflow-hidden cursor-pointer"
            >
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-500"></div>
              
              <div className="relative w-14 h-14 mb-6 border border-white/20 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:scale-110 transition-all duration-500">
                <i className={`fa ${f.icon} text-2xl text-white group-hover:text-black transition-colors duration-500`}></i>
              </div>

              <h3 className="text-2xl font-bold mb-3 group-hover:text-gray-300 transition-colors">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed">{f.desc}</p>
              
              <div className="mt-4 text-sm text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                Learn more →
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= FEED PREVIEW ================= */}
      <Section className="bg-gradient-to-b from-black to-gray-950">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— LIVE FEED —</p>
          <h2 className="text-4xl md:text-6xl font-black">
            <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Trending</span> Rides
          </h2>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { img: biker3, user: "@gokula_ride", bike: "Himalayan 450", text: "Rode 300km through the mountains 🔥", likes: "1.2K", views: "10K", tag: "TRENDING", tagColor: "bg-white" },
            { img: biker2, user: "@rider_anbu", bike: "Royal Enfield", text: "Weekend ride with the squad 💚", likes: "2.4K", views: "25K", tag: "TOP EARNER", tagColor: "bg-gray-300" },
            { img: biker1, user: "@bike_lover", bike: "KTM Duke 390", text: "Night ride vibes ✨", likes: "3.1K", views: "40K", tag: "FEATURED", tagColor: "bg-gray-200" }
          ].map((post, i) => (
            <div key={i} className="group border border-white/10 rounded-2xl overflow-hidden hover:border-white/40 hover:-translate-y-2 hover:shadow-2xl hover:shadow-white/10 transition-all duration-500">
              <div className="relative aspect-square overflow-hidden">
                <img src={post.img} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <span className={`absolute top-4 right-4 ${post.tagColor} text-black px-3 py-1 rounded-full text-xs font-bold`}>{post.tag}</span>
              </div>
              <div className="p-5">
                <p className="text-white font-bold">{post.user} <span className="text-gray-400 text-xs font-normal">on {post.bike}</span></p>
                <p className="text-gray-300 text-sm my-3">{post.text}</p>
                <div className="flex gap-4 text-xs text-gray-400 pt-3 border-t border-white/10">
                  <span>❤️ {post.likes}</span>
                  <span>👁️ {post.views}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= EARN ================= */}
      <Section>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative group order-2 lg:order-1">
            <div className="absolute -inset-4 bg-white/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img
              src={bike1}
              alt="Earn"
              className="relative w-full rounded-2xl border border-white/10 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute -bottom-6 -right-6 px-6 py-3 bg-white text-black rounded-2xl font-black hover:scale-110 transition-transform duration-300 cursor-pointer">
              ₹12,500 EARNED
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <p className="text-sm tracking-widest text-gray-400">— MONETIZE —</p>
            <h2 className="text-4xl md:text-6xl font-black">
              Earn With <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">RideWise</span>
            </h2>
            <p className="text-gray-300 text-lg">Turn your riding passion into real income.</p>

            <div className="space-y-3">
              {[
                { n: "01", t: "Post Your Ride", d: "Share content" },
                { n: "02", t: "Get Engagement", d: "Likes & views" },
                { n: "03", t: "Earn Credits", d: "Based on reach" },
                { n: "04", t: "Withdraw Money", d: "Bank transfer" }
              ].map((step, i) => (
                <div key={i} className="group flex items-center gap-4 p-4 border border-white/10 rounded-xl hover:border-white/40 hover:translate-x-2 transition-all duration-300 cursor-pointer">
                  <span className="w-10 h-10 border border-white/30 rounded-lg flex items-center justify-center font-black group-hover:bg-white group-hover:text-black transition-all duration-300">
                    {step.n}
                  </span>
                  <div>
                    <h4 className="font-bold text-white">{step.t}</h4>
                    <p className="text-sm text-gray-400">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="group px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300">
              Start Earning
              <i className="fa fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
            </button>
          </div>
        </div>
      </Section>

      {/* ================= MARKETPLACE ================= */}
      <Section className="bg-black">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— MARKETPLACE —</p>
          <h2 className="text-4xl md:text-6xl font-black">
            Featured <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Bikes</span>
          </h2>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Royal Enfield Classic 350", price: "₹1,93,000", img: bike1 },
            { name: "KTM Duke 390", price: "₹3,10,000", img: biker2 },
            { name: "Himalayan 450", price: "₹2,85,000", img: biker3 }
          ].map((bike, i) => (
            <div key={i} className="group border border-white/10 rounded-2xl overflow-hidden hover:border-white/40 hover:-translate-y-2 transition-all duration-500">
              <div className="relative overflow-hidden">
                <img src={bike.img} alt={bike.name} className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-700" />
                <span className="absolute top-4 right-4 px-3 py-1 bg-white text-black rounded-full text-xs font-bold">VERIFIED</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 group-hover:text-gray-300 transition-colors">{bike.name}</h3>
                <p className="text-2xl font-black mb-4">{bike.price}</p>
                <button className="w-full py-3 border border-white/30 rounded-full hover:bg-white hover:text-black transition-all duration-300">
                  Buy Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= CTA ================= */}
      <Section className="relative bg-gradient-to-b from-black via-gray-950 to-black text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm tracking-widest text-gray-400 mb-6">— JOIN NOW —</p>
          <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Ready to <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Ride, Create & Earn?</span>
          </h2>
          <p className="text-gray-300 text-lg mb-10">Join 5,000+ riders building audiences and earning from passion.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <button className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300">
              Sign Up Free
            </button>
            <button className="px-8 py-4 border-2 border-white/40 rounded-full hover:bg-white hover:text-black hover:scale-105 transition-all duration-300">
              Learn More
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-5 py-3 bg-white/5 border border-white/20 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
            <button className="px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">
              Get Started
            </button>
          </div>
        </div>
      </Section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-white/10 py-12 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {[
            { title: "Platform", items: ["Home", "Explore", "Create", "Marketplace"] },
            { title: "Creators", items: ["Live", "Earn", "Stories", "Community"] },
            { title: "Company", items: ["About", "Blog", "Careers", "Press"] },
            { title: "Legal", items: ["Privacy", "Terms", "Cookies", "Contact"] }
          ].map((col, i) => (
            <div key={i}>
              <h4 className="font-bold mb-3 text-white">{col.title}</h4>
              <ul className="space-y-2">
                {col.items.map((item, j) => (
                  <li key={j}>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">© 2024 RideWise. Made for riders.</p>
          <div className="flex gap-3">
            {["fa-facebook", "fa-instagram", "fa-twitter", "fa-youtube"].map((icon, i) => (
              <a key={i} href="#" className="w-9 h-9 border border-white/20 rounded-full flex items-center justify-center hover:bg-white hover:text-black hover:scale-110 transition-all duration-300">
                <i className={`fa ${icon} text-sm`}></i>
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}

export default Landing;
