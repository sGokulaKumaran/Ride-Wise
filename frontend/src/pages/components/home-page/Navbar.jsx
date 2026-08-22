import React from 'react';
import ThemeDropdown from '../../shared/ThemeDropdown';

const Navbar = () => {
  return (
    <nav className="flex justify-between items-center p-4 border-b border-white/10">
      <div className="text-xl font-bold">RideWise</div>
      <div className="flex items-center gap-4">
        <ThemeDropdown />
        <button className="px-4 py-2 bg-white text-black rounded-full font-bold">Sign In</button>
      </div>
    </nav>
  );
};

export default Navbar;
