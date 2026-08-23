// ============================================================
// 📰 Feed — Main feed container with mixed content types
// Mixes: Posts, Bikes like a real social/marketplace app
// ============================================================

import PostCard from "./PostCard";
import BikeCard from "./BikeCard";
import StoryRow from "./StoryRow";

export default function Feed({ tc }) {
  // 🔄 Mixed feed: posts + bike marketplace cards
  const feedItems = [
    {
      type: "post",
      user: "@rider_arjun",
      location: "Spiti Valley, HP",
      time: "2h ago",
      image: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=800&auto=format&q=80",
      caption: "Made it to the top! 🏔️ 500km journey, totally worth it. The Himalayas never disappoint. Every twist and turn was a reminder of why we ride! #SpitiValley #RoyalEnfield",
      bike: "Himalayan 450",
      tag: "TRENDING",
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
      type: "post",
      user: "@mountain_rider",
      location: "Leh, Ladakh",
      time: "5h ago",
      image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&q=80",
      caption: "Sunrise at 18,000ft. This is why we ride. 🌅 Words can't describe the feeling when the first light hits the mountains. Pure magic.",
      bike: "Royal Enfield",
      likes: 3420,
      comments: 245,
    },
    {
      type: "post",
      user: "@bike_lover",
      location: "Chennai, TN",
      time: "8h ago",
      image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&q=80",
      caption: "New R15 day! 🎉 First impressions — absolutely stunning. Full review dropping this weekend. Don't miss it! Subscribe now.",
      bike: "Yamaha R15",
      tag: "NEW",
      likes: 890,
      comments: 56,
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
      caption: "Night rides are something else entirely. 🌙 Empty roads, cool breeze, city lights fading in the mirror. Pure freedom. #NightRide #MumbaiRiders",
      bike: "Kawasaki Z900",
      tag: "FEATURED",
      likes: 2150,
      comments: 134,
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
    <div className="max-w-2xl mx-auto px-4 py-6" id="explore">
      {/* Stories at top */}
      <StoryRow tc={tc} />

      {/* Feed Items - mixed content */}
      {feedItems.map((item, i) =>
        item.type === "post" ? (
          <PostCard key={i} post={item} tc={tc} />
        ) : (
          <BikeCard key={i} bike={item} tc={tc} />
        )
      )}

      {/* Load More */}
      <div className="text-center py-8">
        <button
          className={`px-8 py-3 rounded-full border font-semibold transition-all hover:scale-105 active:scale-95 ${tc.card} ${tc.cardHover}`}
        >
          <i className="fa fa-refresh mr-2"></i>
          Load More Posts
        </button>
      </div>
    </div>
  );
}
