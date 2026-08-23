// ============================================================
// 📸 PostCard — Post with bike tag + ride tag + buy CTA
// User shares review/photo with bike and ride location tags
// Tapping bike tag navigates to BikeDetailView
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PostCard({ post, tc }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const [showComment, setShowComment] = useState(false);

  const toggleLike = () => {
    setLiked((prev) => {
      setLikes((l) => (prev ? l - 1 : l + 1));
      return !prev;
    });
  };

  const viewBike = () => {
    if (post.bike)
      navigate(`/bike/${post.bike.toLowerCase().replace(/\s+/g, "-")}`);
  };

  const viewRide = () => {
    if (post.ride)
      navigate(`/ride/${post.ride.toLowerCase().replace(/\s+/g, "-")}`);
  };

  return (
    <div className={`rounded-2xl overflow-hidden border ${tc.card} mb-6 transition-all hover:shadow-2xl`}>

      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm ring-2 ring-orange-500/30">
            {post.user.replace("@", "").charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-current"></span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">{post.user}</p>
          <p className={`text-xs ${tc.sub} flex items-center gap-1`}>
            <i className="fa fa-location-dot"></i> {post.location}
            {post.bike && (
              <button
                onClick={viewBike}
                className="ml-1 text-orange-400 hover:underline font-semibold"
              >
                🏍️ {post.bike}
              </button>
            )}
          </p>
        </div>
        <button className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${tc.sub} transition-colors`}>
          <i className="fa fa-ellipsis-h"></i>
        </button>
      </div>

      {/* Image */}
      <div className="relative bg-black">
        <img
          src={post.image}
          alt={post.caption}
          className="w-full h-auto max-h-[600px] object-cover"
          loading="lazy"
        />
        {post.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <i className="fa fa-play text-white text-2xl ml-1"></i>
            </div>
          </div>
        )}
        {/* Inline bike tag overlay */}
        {post.bike && (
          <button
            onClick={viewBike}
            className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-md text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-black/90 transition-colors"
          >
            <i className="fa fa-motorcycle text-orange-400"></i>
            {post.bike}
            {post.bikePrice && <span className="opacity-70">• {post.bikePrice}</span>}
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLike}
            className={`transition-all hover:scale-125 active:scale-95 ${liked ? "text-red-500" : tc.text}`}
          >
            <i className={`${liked ? "fas" : "far"} fa-heart text-2xl`}></i>
          </button>
          <button
            onClick={() => setShowComment((s) => !s)}
            className={`transition-all hover:scale-125 ${tc.text}`}
          >
            <i className="far fa-comment text-2xl"></i>
          </button>
          <button className={`transition-all hover:scale-125 ${tc.text}`}>
            <i className="far fa-paper-plane text-2xl"></i>
          </button>
        </div>
        <button
          onClick={() => setSaved((s) => !s)}
          className={`transition-all hover:scale-125 active:scale-95 ${saved ? "text-yellow-400" : tc.text}`}
        >
          <i className={`${saved ? "fas" : "far"} fa-bookmark text-2xl`}></i>
        </button>
      </div>

      {/* Likes */}
      <div className="px-4 pb-2">
        <p className="font-bold text-sm">{likes.toLocaleString()} likes</p>
      </div>

      {/* Caption + tag buttons */}
      <div className="px-4 pb-3 space-y-2">
        <p className="text-sm">
          <span className="font-bold mr-2">{post.user}</span>
          {post.caption}
        </p>
        <div className="flex flex-wrap gap-2">
          {post.bike && (
            <button
              onClick={viewBike}
              className={`text-xs px-3 py-1.5 rounded-full border ${tc.divider} hover:bg-white/10 transition-colors flex items-center gap-1`}
            >
              🏍️ View {post.bike}
            </button>
          )}
          {post.ride && (
            <button
              onClick={viewRide}
              className={`text-xs px-3 py-1.5 rounded-full border ${tc.divider} hover:bg-white/10 transition-colors flex items-center gap-1`}
            >
              📍 {post.ride}
            </button>
          )}
        </div>
      </div>

      {/* Comments section */}
      <div className={`px-4 pb-4 border-t ${tc.divider}`}>
        <button className={`text-xs ${tc.sub} hover:underline mt-3 block`}>
          View all {post.comments} comments
        </button>
        {showComment && (
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              R
            </div>
            <input
              type="text"
              placeholder="Add a comment..."
              className={`flex-1 bg-transparent outline-none text-xs ${tc.sub}`}
            />
            <button className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
