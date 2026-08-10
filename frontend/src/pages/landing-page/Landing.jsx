import "./Landing.css";

// import video
import introBike from "@/assets/videos/bikebgm.mp4";
import mounbgm from "@/assets/videos/mounbgm.mp4";
//import images
import bike1 from "@/assets/images/bike1.png"
import biker1 from "@/assets/images/biker1.jpg"
import biker2 from "@/assets/images/biker2.png"
import biker3 from "@/assets/images/biker3.jpg"
import mountain from "@/assets/images/mountain.png"
import sketchbike from "@/assets/images/sketchbike.png"

function Landing() {
  return (
    <>
      {/* ================= NAVBAR ================= */}
      <header id="header">
        <div id="htext">
          <i className="fa fa-motorcycle" aria-hidden="true"></i>
          <span>RideWise</span>
        </div>

        <div id="nav-container">
          <span className="nav-items">Home</span>
          <span className="nav-items">About</span>
          <span className="nav-items">Blog</span>
          <span className="nav-items">Services</span>
          <span className="nav-items">Contact</span>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <div className="box1">
        <video
          id="bgmvid"
          src={introBike} autoPlay loop mute
          autoPlay
          loop
          muted
        ></video>

        <div id="box1-text">
          <h1>
            Ride Beyond Limits, <br />
            Discover your Perfect Bike
          </h1>

          <div className="box-but1">
            <button className="but1">Explore</button>
          </div>
        </div>
      </div>

      {/* Extra Space */}
      <div style={{ width: "100vw", height: "100px" }}></div>

      {/* ================= ABOUT ================= */}
      <div className="box2">
        <h1
          style={{
            marginTop: "30px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <u>About</u>
        </h1>

        <div id="bike-imgbox">
          <img
            id="img1"
            src={sketchbike}
            alt="Bike Sketch"
          />
        </div>

        <div id="ab-box">
          <div id="ab-conbox">
            <h1
              id="bike-text"
              style={{
                textAlign: "center",
                width: "100%",
              }}
            >
              Bikes
            </h1>

            <p id="ab-content">
              At MT,R15, we believe biking is more than just a ride - it's
              freedom, adventure, and passion on two wheels. At MT,R15, we
              believe biking is more than just a ride - it's freedom,
              adventure, and passion on two wheels.
            </p>

            <div
              className="box-but1"
              style={{ marginTop: "50px" }}
            >
              <button className="but1">View more</button>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Space */}
      <div style={{ width: "100%", height: "200px" }}></div>

      {/* ================= SECOND VIDEO ================= */}
      <div className="box3">
        <video
          style={{
            height: "100vh",
            width: "100vw",
          }}
          src={mounbgm}
          autoPlay
          loop
          muted
        ></video>

        <div id="box3-con">
          <h1>"Passion on Two Wheels"</h1>

          <p>
            We are committed to delivering high-performance bikes designed
            for every kind of rider. Whether you're chasing speed,
            commuting to work, or exploring the open road, we've got the
            perfect bike for you.
          </p>

          <div className="box-but1">
            <button className="but1">
              Explore Model
            </button>
          </div>
        </div>
      </div>

      {/* Extra Space */}
      <div style={{ width: "100vw", height: "100px" }}></div>

      {/* ================= SERVICES ================= */}
      <div className="box4">
        <div id="serviceH">
          <h1>
            <u>Services</u>
          </h1>
        </div>

        <div className="box4_sec">
          <h1>Bike Maintenance & Repairs</h1>

          <p>
            Regular servicing and tune-ups <br />
            Engine and brake check <br />
            Tyre replacement and wheel alignment <br />
            Chain and gear adjustments
          </p>

          <img
            src={bike1}
            alt="Bike"
          />
        </div>

        <div className="box4_sec">
          <h1>Performance Upgrades</h1>

          <p>
            Engine performance tuning <br />
            Exhaust system upgrades <br />
            Suspension and handling setup <br />
            High-performance air filter installation
          </p>

          <img
            src={bike1}
            alt="Bike"
          />
        </div>

        <div className="box4_sec">
          <h1>Bike Wash & Detailing</h1>

          <p>
            Premium foam bike wash <br />
            Body polishing and paint protection <br />
            Chain cleaning and lubrication <br />
            Complete interior and exterior detailing
          </p>

          <img
            src={bike1}
            alt="Bike"
          />
        </div>
      </div>

      {/* Extra Space */}
      <div style={{ width: "100vw", height: "100px" }}></div>

      {/* ================= BLOG ================= */}
      <div className="boxBlog">

        {/* Blog 1 */}
        <div className="BLbox">
          <div className="box1Hover">
            <img
              id="img1"
              src={biker3}
              alt="Rider"
            />
          </div>

          <div className="boxconR">
            <h1>Explore more with freedom</h1>

            <p>
              Experience the joy of exploring new destinations on a bike.
              Feel the wind, embrace the open road, and discover hidden
              places at your own pace.
            </p>
          </div>

          <div className="box2Hover">
            <img
              id="imgM"
              src={mountain}
              alt="Mountain"
            />
          </div>
        </div>

        {/* Blog 2 */}
        <div className="BLbox">
          <div className="box2Hover">
            <img
              id="imgM"
              src={mountain}
              alt="Mountain"
            />
          </div>

          <div className="boxconL">
            <h1>Budget-Friendly Journeys</h1>

            <p>
              Experience the joy of exploring new destinations on a bike.
              Feel the wind, embrace the open road, and discover hidden
              places at your own pace.
            </p>
          </div>

          <div className="box1Hover">
            <img
              id="img2"
              src={biker2}
              alt="Rider"
            />
          </div>
        </div>

        {/* Blog 3 */}
        <div className="BLbox">
          <div className="box1Hover">
            <img
              id="img3"
              src={biker1}
              alt="Rider"
            />
          </div>

          <div className="boxconR">
            <h1>Capture beautiful experience</h1>

            <p>
              Experience the joy of exploring new destinations on a bike.
              Feel the wind, embrace the open road, and discover hidden
              places at your own pace.
            </p>
          </div>

          <div className="box2Hover">
            <img
              id="imgM"
              src={mountain}
              alt="Mountain"
            />
          </div>
        </div>

        {/* Road SVG */}
        <svg className="road">
          <path
            d="
              M430 40
              C30 220 580 260 580 460
              C580 720 160 720 160 980
              C160 1280 700 1280 700 1500
            "
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="10 10"
          />
        </svg>
      </div>

      {/* ================= CONTACT ================= */}
      <div className="box5">
        <img
          className="box5-bike"
          src={bike1}
          alt="Bike"
        />

        <div className="box5-content">
          <div className="box5-left">
            <h1>Bike Website</h1>

            <h2>"Got a Question? Let's Connect!"</h2>

            <p>
              Whether you need bike suggestions, reviews, or buying
              guidance — we're here to help.
            </p>
          </div>

          <div className="box5-right">
            <h2>Contact</h2>

            <p>
              <strong>Address:</strong> Chennai, India
            </p>

            <p>
              <strong>Phone:</strong> +91 98765 43210
            </p>

            <p>
              <strong>Email:</strong> support@bikehub.com
            </p>

            <p>
              <strong>Working Hours:</strong>
              <br />
              Mon – Sat (9:00 AM – 7:00 PM)
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Landing;