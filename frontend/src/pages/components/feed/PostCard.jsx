// ============================================================
// 📸 PostCard — Instagram-style post component
// Has: User header, image/video, like/comment/share, caption
// ============================================================

import { useState } from "react";

export default function PostCard({ post, tc }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(false);

  // Toggle like with count animation
  const toggleLike = () => {
    setLiked((prev) => {
      setLikes((l) => (prev ? l - 1 : l + 1));
      return !prev;
    });
  };

  return (
    <div className={`rounded-2xl overflow-hidden border ${tc.card} mb-6 transition-all hover:shadow-2xl`}>

      {/* Post Header - User info */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm ring-2 ring-orange-400/30">
          {post.user.replace("@", "").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">{post.user}</p>
          <p className={`text-xs ${tc.sub}`}>{post.location} • {post.time}</p>
        </div>
        <button className={`w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center ${tc.sub} transition-colors`}>
          <i className="fa fa-ellipsis-h"></i>
        </button>
      </div>

      {/* Main Image */}
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
        {post.tag && (
          <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${tc.badge}`}>
            {post.tag}
          </span>
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
          <button className={`transition-all hover:scale-125 ${tc.text}`}>
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

      {/* Likes Count */}
      <div className="px-4 pb-2">
        <p className="font-bold text-sm">{likes.toLocaleString()} likes</p>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-sm">
          <span className="font-bold mr-2">{post.user}</span>
          {post.caption}
        </p>
        {post.bike && (
          <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full border ${tc.divider} ${tc.sub}`}>
            🏍️ {post.bike}
          </span>
        )}
      </div>

      {/* View Comments & Add Comment */}
      <div className={`px-4 pb-4 border-t ${tc.divider}`}>
        <button className={`text-xs ${tc.sub} hover:underline mt-3`}>
          View all {post.comments} comments
        </button>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            R
          </div>
          <input
            type="text"
            placeholder="Add a comment..."
            className={`flex-1 bg-transparent outline-none text-xs ${tc.sub}`}
          />
        </div>
      </div>
    </div>
  );
}
