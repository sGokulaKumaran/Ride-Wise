// ============================================================
// 📰 Feed — Mixed content feed (Posts + Bikes + Rides + Lives + DRides)
// Single scroll = everything a rider needs
// ============================================================

import { useState } from "react";
import PostCard from "./PostCard";
import BikeCard from "./BikeCard";
import RideCard from "./RideCard";
import LiveCard from "./LiveCard";
import StoryRow from "./StoryRow";
import DRideModal from "../shared/DRideModal";

export default function Feed({ tc }) {
  const [selectedDRide, setSelectedDRide] = useState(null);

  // DRides (stories) — bike-tagged ride experiences
  const drides = [
    { id: 1, title: "Spiti Trip",    cover: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=200&h=200&fit=crop", bike: "Himalayan", viewed: false },
    { id: 2, title: "Daily Ride",    cover: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=200&h=200&fit=crop", bike: "R15",       viewed: false },
    { id: 3, title: "Leh Ride",      cover: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&h=200&fit=crop", bike: "RE 650",   viewed: true  },
    { id: 4, title: "Beach Run",     cover: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200&h=200&fit=crop", bike: "Duke 390", viewed: false },
    { id: 5, title: "Night City",    cover: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=200&h=200&fit=crop", bike: "Ninja 300",viewed: false },
    { id: 6, title: "Hill Climb",    cover: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=200&h=200&fit=crop", bike: "Himalayan", viewed: true  },
  ];

  // Mixed feed — posts, bikes, rides, lives interleaved
  const feedItems = [
    {
      type: "post",
      user: "@rider_arjun",
      location: "Spiti Valley, HP",
      time: "2h ago",
      image: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=800&auto=format&q=80",
      caption: "Made it to the top! 🏔️ 500km journey, totally worth it. The Himalayas never disappoint. Every twist and turn was pure magic. #SpitiValley #Himalayan",
      bike: "Himalayan 450",
      bikePrice: "₹2.85L",
      ride: "Spiti Valley Loop",
      likes: 1240,
      comments: 89,
    },
    {
      type: "bike",
      name: "Yamaha R15 V4",
      price: "₹1,82,000",
      originalPrice: "₹1,95,000",
      discount: "7%",
      image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&q=80",
      rating: 4.7,
      reviews: 234,
      category: "Sport",
      tag: "BESTSELLER",
    },
    {
      type: "ride",
      name: "Chennai → Pondicherry",
      distance: "162 km",
      duration: "3.5 hrs",
      difficulty: "Easy",
      bestBike: "Any 150cc+",
      rating: 4.6,
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&q=80",
    },
    {
      type: "live",
      user: "@rider_x",
      title: "Chennai Night Ride 🌙",
      viewers: 1204,
      bike: "Royal Enfield 650",
      image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&q=80",
    },
    {
      type: "post",
      user: "@mountain_rider",
      location: "Leh, Ladakh",
      time: "5h ago",
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&q=80",
      caption: "Sunrise at 18,000ft. This is why we ride. 🌅 No words can describe the feeling. Pure freedom.",
      bike: "Royal Enfield 650",
      ride: "Manali-Leh Highway",
      likes: 3420,
      comments: 245,
    },
    {
      type: "bike",
      name: "KTM Duke 390",
      price: "₹3,10,000",
      originalPrice: "₹3,25,000",
      discount: "5%",
      image: "https://images.unsplash.com/photo-1611516491426-01d49ce9b4d6?w=800&auto=format&q=80",
      rating: 4.6,
      reviews: 412,
      category: "Naked",
      tag: "HOT",
    },
    {
      type: "post",
      user: "@night_rider_raj",
      location: "Mumbai-Pune Highway",
      time: "12h ago",
      image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&q=80",
      caption: "Night rides are something else entirely. 🌙 Empty roads, cool breeze, city lights fading in the mirror. #NightRide",
      bike: "Kawasaki Z900",
      tag: "FEATURED",
      likes: 2150,
      comments: 134,
    },
    {
      type: "ride",
      name: "Manali → Rohtang Pass",
      distance: "51 km",
      duration: "2 hrs",
      difficulty: "Hard",
      bestBike: "Adventure 250cc+",
      rating: 4.9,
      image: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=800&auto=format&q=80",
    },
    {
      type: "bike",
      name: "Royal Enfield Hunter 350",
      price: "₹1,49,000",
      originalPrice: "₹1,60,000",
      discount: "7%",
      image: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&auto=format&q=80",
      rating: 4.5,
      reviews: 628,
      category: "Classic",
      tag: "POPULAR",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" id="feed">

      {/* DRides row at top */}
      <StoryRow tc={tc} drides={drides} onOpenDRide={setSelectedDRide} />

      {/* Mixed feed */}
      {feedItems.map((item, i) => {
        if (item.type === "post") return <PostCard key={i} post={item} tc={tc} />;
        if (item.type === "bike") return <BikeCard key={i} bike={item} tc={tc} />;
        if (item.type === "ride") return <RideCard key={i} ride={item} tc={tc} />;
        if (item.type === "live") return <LiveCard key={i} live={item} tc={tc} />;
        return null;
      })}

      {/* Load More */}
      <div className="text-center py-8">
        <button
          className={`px-8 py-3 rounded-full border font-semibold transition-all hover:scale-105 active:scale-95 ${tc.card} ${tc.cardHover}`}
        >
          <i className="fa fa-refresh mr-2"></i>
          Load More
        </button>
      </div>

      {/* DRide Modal */}
      {selectedDRide && (
        <DRideModal
          dride={selectedDRide}
          onClose={() => setSelectedDRide(null)}
          tc={tc}
        />
      )}
    </div>
  );
}
