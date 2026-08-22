import "./Landing.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import introBike from "@/assets/videos/bikebgm.mp4";
import mounbgm from "@/assets/videos/mounbgm.mp4";

import bike1 from "@/assets/images/bike1.png";
import biker1 from "@/assets/images/biker1.jpg";
import biker2 from "@/assets/images/biker2.png";
import biker3 from "@/assets/images/biker3.jpg";
import mountain from "@/assets/images/mountain.png";
import sketchbike from "@/assets/images/sketchbike.png";

const Section = ({ children, className = "" }) => (
  <section className={`w-full py-20 md:py-28 px-6 md:px-16 ${className}`}>
    {children}
  </section>
);

function Landing() {
  const navigate = useNavigate();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const [scrolled, setScrolled] = useState(false);

  // Mouse position tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      
      // Calculate tilt for 3D cards
      const x = (window.innerWidth / 2 - e.clientX) / 50;
      const y = (window.innerHeight / 2 - e.clientY) / 50;
      setCardTilt({ x, y });
    };

    const handleScroll = () => setScrolled(window.scrollY > 50);
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="bg-black text-white overflow-x-hidden font-sans">
      
      {/* ================= NAVBAR ================= */}
      <header className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 md:px-16 py-5 backdrop-blur-md border-b transition-all duration-500 ${
        scrolled ? "bg-black/90 border-white/20 py-3" : "bg-black/50 border-white/10"
      }`}>
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-2xl md:text-3xl font-bold flex items-center gap-3 hover:scale-105 transition-transform duration-300 cursor-pointer"
        >
          <i className="fa fa-motorcycle text-white"></i>
          <span>RideWise</span>
        </div>
        
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => navigate("/login")}
            className="px-5 py-2 border border-white/40 rounded-full hover:bg-white hover:text-black transition-all duration-300 hover:scale-105"
          >
            Login
          </button>
          <button 
            onClick={() => navigate("/login")}
            className="px-5 py-2 bg-white text-black rounded-full font-bold hover:scale-105 hover:shadow-2xl hover:shadow-white/20 transition-all duration-300"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <Section className="relative h-screen flex flex-col justify-center items-center text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video src={introBike} autoPlay loop muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black"></div>
        </div>

        {/* Animated gradient orb following mouse */}
        <div 
          className="pointer-events-none absolute w-96 h-96 rounded-full blur-3xl opacity-30 transition-all duration-300"
          style={{
            left: mousePos.x - 192,
            top: mousePos.y - 192,
            background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)"
          }}
        />

        {/* Floating particles
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.2,
                animation: `pulse ${Math.random() * 3 + 2}s infinite`,
                animationDelay: `${Math.random() * 3}s`
              }}
            ></div>
          ))}
        </div> */}

        <div className="relative z-20 max-w-5xl">
          <div className="inline-block px-4 py-2 mb-6 border border-white/30 rounded-full text-sm tracking-widest backdrop-blur-md hover:border-white transition-colors">
             #1 RIDER CREATOR PLATFORM
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-6">
            Share Your Ride.
            <br />
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              Earn From Your Journey
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Join 5,000+ riders turning passion into content and content into income.
            <br />
            <span className="text-white font-semibold">Post • Stream • Earn • Sell</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate("/login")}
              className="group px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-110 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300"
            >
              Get Started Free
              <i className="fa fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform inline-block"></i>
            </button>
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
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— ABOUT RIDEWISE —</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Where Riders <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Create & Earn</span>
          </h2>
          <div className="w-20 h-1 bg-white mx-auto rounded-full"></div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* 3D Tilt Card */}
          <div 
            className="relative overflow-hidden rounded-2xl"
            style={{
              transform: `perspective(1000px) rotateY(${cardTilt.x}deg) rotateX(${-cardTilt.y}deg)`,
              transition: "transform 0.2s ease-out"
            }}
          >
            <img src={sketchbike} alt="Bike" className="w-full h-auto rounded-2xl hover:scale-105 transition-transform duration-700" />
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
                <div key={i} className="text-center p-5 border border-white/10 rounded-2xl hover:border-white/40 hover:scale-105 transition-all duration-300">
                  <div className="text-3xl font-black">{stat.num}</div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ================= MISSION ================= */}
      <Section className="relative h-screen flex flex-col justify-center items-center overflow-hidden">
        <video src={mounbgm} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/70"></div>

        <div className="relative z-10 text-center max-w-4xl px-6">
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
            Every Ride is Content.
            <br />
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Every Creator Earns.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-10">
            Empowering riders to build audiences, monetize passion, and connect globally.
          </p>
          <button 
            onClick={() => navigate("/login")}
            className="group px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-110 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300"
          >
            Start Your Journey
            <i className="fa fa-motorcycle ml-2 group-hover:rotate-12 transition-transform inline-block"></i>
          </button>
        </div>
      </Section>

      {/* ================= FEATURES ================= */}
      <Section className="bg-black">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-gray-400 mb-3">— FEATURES —</p>
          <h2 className="text-4xl md:text-6xl font-black">
            Everything You Need to <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Ride & Earn</span>
          </h2>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "Post Your Journey", icon: "fa-camera", desc: "Share photos and videos from your rides" },
            { title: "Live Streaming", icon: "fa-broadcast-tower", desc: "Go live and interact with viewers" },
            { title: "Earn Credits", icon: "fa-coins", desc: "Get credits for engagement" },
            { title: "Marketplace", icon: "fa-shopping-cart", desc: "Buy and sell bikes" },
            { title: "Community", icon: "fa-users", desc: "Connect with riders worldwide" },
            { title: "Bike Tagging", icon: "fa-tag", desc: "Tag your bike on every post" }
          ].map((f, i) => (
            <div
              key={i}
              className="group p-8 border border-white/10 rounded-2xl hover:border-white/40 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
            >
              <div className="w-14 h-14 mb-6 border border-white/20 rounded-xl flex items-center justify-center group-hover:bg-white transition-all duration-500">
                <i className={`fa ${f.icon} text-2xl text-white group-hover:text-black transition-colors`}></i>
              </div>
              <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
              <p className="text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= CTA ================= */}
      <Section className="text-center">
        <h2 className="text-5xl md:text-7xl font-black mb-6">
          Ready to <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Ride, Create & Earn?</span>
        </h2>
        <p className="text-gray-300 text-lg mb-10">Join 5,000+ riders building audiences and earning from passion.</p>
        <button 
          onClick={() => navigate("/login")}
          className="px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-110 hover:shadow-2xl hover:shadow-white/30 transition-all duration-300"
        >
          Sign Up Free
        </button>
      </Section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-white/10 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center">
              <i className="fa fa-motorcycle text-sm"></i>
            </div>
            <p className="text-gray-400 text-sm">© 2026 RideWise. Made for riders.</p>
          </div>
          <div className="flex gap-3">
            {["fa-facebook", "fa-instagram", "fa-twitter", "fa-youtube"].map((icon, i) => (
              <a key={i} href="#" className="w-9 h-9 border border-white/20 rounded-full flex items-center justify-center hover:bg-white hover:text-black hover:scale-110 transition-all">
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
