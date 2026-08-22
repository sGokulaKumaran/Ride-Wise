import React from 'react';
import Navbar from '../components/home/Navbar';
import Hero from '../components/home/Hero';
import TrendingVideos from '../components/home/TrendingVideos';
import ExploreBikes from '../components/home/ExploreBikes';
import PopularRides from '../components/home/PopularRides';
import FeaturedVideo from '../components/home/FeaturedVideo';
import RiderEssentials from '../components/home/RiderEssentials';
import LiveRides from '../components/home/LiveRides';
import RideStories from '../components/home/RideStories';
import Footer from '../components/home/Footer';
import { useTheme } from '../hooks/useTheme';

const Home = () => {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <Navbar />
      <Hero />
      <TrendingVideos />
      <ExploreBikes />
      <PopularRides />
      <FeaturedVideo />
      <RiderEssentials />
      <LiveRides />
      <RideStories />
      <Footer />
    </div>
  );
};

export default Home;
