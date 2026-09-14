import os

output_dir = r"E:\My projects\RideWise\Project Details\frontend"
os.makedirs(output_dir, exist_ok=True)

explanations = {}

explanations["Login.jsx_explanation.txt"] = """File: Login.jsx
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\landing-page\\Login.jsx
What it does: This is the entry point authentication page for the RideWise app, serving as both a login and sign-up page.

Lines 1-22: A large comment block explaining the purpose of the file, the available tabs (Login and Sign Up), features like auto-theme, voice control, mouse glow, and instructions for replacing the backend logic once it's ready.
Line 24: Imports useCallback, useEffect, useRef, and useState from React. These are hooks used to manage component state, side effects, and DOM references.
Line 25: Imports useNavigate from react-router-dom to handle redirecting the user to different routes.
Line 26: Imports the custom useAuth hook from the AuthContext to access login, signup, and authentication states.
Line 28: Defines and exports the default functional component 'LoginPage'.
Lines 29-30: Initializes the navigate function and destructured values from useAuth (login, signup, isAuthenticated, isFullyOnboarded).
Lines 32-36: Defines refs using useRef. containerRef is for mouse glow, cardRef for 3D tilt, dropdownRef for theme dropdown, and trailRef for cursor trail.
Lines 38-46: Defines various UI state variables using useState (theme, isLogin, mousePos, ripples, tilt, themeOpen, voiceMode, focused).
Lines 48-54: Defines form state variables (email, password, showPassword, passwordStrength, loading, error).
Lines 56-101: Defines a 'themes' object containing configuration for 'dark', 'light', 'warm', and 'midnight' themes. Each key maps to Tailwind CSS classes for styling.
Line 102: Assigns the currently active theme object to a variable 'tc' for shorthand access.
Lines 104-111: A useEffect hook that runs once on mount. It checks the current hour and sets the initial theme based on the time of day.
Lines 113-119: A useEffect hook that redirects authenticated users to '/home' or '/onboarding' depending on their onboarding status.
Lines 121-130: A useEffect hook that adds a mousedown event listener to close the theme dropdown if the user clicks outside of it.
Lines 132-156: A useEffect hook tracking mouse movement. It calculates the mouse position for the glow effect, computes the 3D tilt based on the card's bounding rect, and pushes cursor trail positions to trailRef.
Lines 158-162: A useEffect hook that sets an interval to clear the cursor trail every 100ms.
Lines 164-172: A useEffect hook that calculates the password strength score (0 to 100) based on length, uppercase, number, and special character presence.
Lines 174-183: Defines a 'createRipple' callback function that creates a ripple effect on button clicks by capturing click coordinates and appending them to the 'ripples' state.
Lines 185-212: Defines 'startVoice', a function that uses the Web Speech API (SpeechRecognition) to change themes or toggle login/signup modes via voice commands. It auto-stops after 6 seconds.
Lines 214-240: Defines 'handleSubmit', an async function that prevents default form submission, validates input, sets loading state, calls login or signup from AuthContext, navigates on success, and handles errors.
Lines 242-246: Determines the color of the password strength bar based on the calculated strength score.
Lines 248-252: Returns the main container div, applying dynamic background classes and attaching the containerRef.
Lines 254-267: Renders the cursor trail by mapping over trailRef items and rendering divs at their recorded coordinates.
Lines 269-275: Renders a div for the mouse glow radial gradient effect.
Lines 277-293: Renders ambient floating particles using an array of 20 random animated divs.
Lines 295-358: Renders the top bar containing the RideWise logo, voice control button, and theme switcher dropdown.
Lines 360-363: Opens the main content grid layout wrapper.
Lines 364-418: Renders the left column for desktop view, showing marketing copy, stats, and a testimonial.
Lines 420-428: Wraps the right column auth form card in a div with dynamic 3D transform styles (tilt).
Lines 430-437: Renders the outer glow behind the form card.
Lines 439-442: Renders the main card container with backdrop blur and border styling.
Lines 444-458: Renders the Login/Sign Up tab switcher buttons.
Lines 460-470: Renders the dynamic heading and subheading based on the isLogin state.
Lines 472-478: Conditionally renders the inline error message if 'error' state is not empty.
Lines 480-481: Starts the form element and attaches handleSubmit to onSubmit.
Lines 483-505: Renders the email input field and its label/icon.
Lines 507-545: Renders the password input field, show/hide toggle button, and the password strength bar (only for signup).
Lines 547-559: Conditionally renders 'Remember me' and 'Forgot password' for the login tab.
Lines 561-592: Renders the submit button, showing a loading spinner if active, and mapping over the 'ripples' state to render click animations.
Lines 594-605: Renders a toggle link at the bottom to switch between Login and Sign Up.
Lines 607-636: Conditionally renders the 'What happens next' steps panel for the Sign Up tab.
Lines 638-644: Renders the terms and privacy policy agreement text.
Lines 648-649: Injects an inline style tag containing the CSS keyframes for the ripple animation.
Lines 650-653: Closes all main container divs and exports the component.
"""

explanations["useTheme.js_explanation.txt"] = """File: useTheme.js
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\hooks\\useTheme.js
What it does: This file exports a custom React hook to manage visual themes and a predefined set of theme objects.

Line 1: Imports 'useState' and 'useEffect' from React.
Lines 3-65: Defines and exports the 'themes' object. It contains keys for 'dark', 'light', 'warm', and 'midnight'. Each key maps to a bundle of Tailwind CSS classes that dictate the background, text color, card styling, inputs, and gradients used throughout the app.
Line 67: Defines and exports the 'useTheme' functional hook.
Lines 69-80: Uses 'useState' to initialize the 'theme' state. It uses a lazy initialization function that first tries to retrieve 'ridewise-theme' from localStorage. If none is found or if it's invalid, it gets the current hour via Date().getHours() and returns a theme based on the time (warm for morning, light for day, dark for evening, midnight for night).
Lines 82-85: A useEffect hook that listens to changes in the 'theme' state. Whenever 'theme' changes, it saves the new theme to localStorage. A try-catch block is used to prevent errors if localStorage is unavailable.
Line 87: Returns an object containing the current 'theme' string, the 'setTheme' function to update it, 'tc' which holds the resolved theme classes from 'themes[theme]', and 'allThemes' to access the full list.
Lines 88-89: A comment and the closing brace for the hook.
"""

explanations["useRideLocation.js_explanation.txt"] = """File: useRideLocation.js
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\hooks\\useRideLocation.js
What it does: Provides a custom React hook that tracks the user's live location by calling a location service.

Lines 1-12: A header comment explaining the hook's purpose, how to use it, and what the 'active' parameter does.
Line 14: Imports 'useState' and 'useEffect' from React.
Line 15: Imports the 'watchLocation' function from a local locationService module.
Line 17: Defines and exports the 'useRideLocation' hook, taking an optional 'active' parameter defaulting to true.
Lines 18-20: Initializes state variables: 'location' (to store coordinates), 'error' (to store any errors), and 'isWatching' (a boolean tracking if the watcher is active).
Lines 22-23: Starts a useEffect block that re-runs when the 'active' parameter changes. If 'active' is false, it returns early.
Line 25: Sets 'isWatching' to true.
Lines 27-30: Calls 'watchLocation' passing a callback function. When the service gets a new location, it updates 'location' and clears 'error'. The 'watchLocation' function returns a cleanup/stop function, which is assigned to the 'stop' variable.
Lines 32-37: Returns a cleanup function for the useEffect. When the component unmounts or 'active' becomes false, it calls 'stop()' and sets 'isWatching' to false.
Line 39: Returns an object containing the current 'location', 'error', and 'isWatching' state values.
Lines 40-41: Closes the hook definition.
"""

explanations["Sidebar.jsx_explanation.txt"] = """File: Sidebar.jsx
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\components\\layout\\Sidebar.jsx
What it does: Renders the left navigation sidebar used on desktop layouts.

Lines 1-17: Header comments explaining the intent of the Sidebar, currently available items, and the bottom account menu.
Line 19: Imports 'useNavigate' and 'useLocation' from react-router-dom to handle navigation and detect the active route.
Line 20: Imports the 'AccountMenu' component.
Line 22: Defines and exports the default Sidebar component, accepting a 'tc' (theme classes) object via props.
Lines 23-24: Initializes 'navigate' and 'location' using the React Router hooks.
Line 26: Calculates a boolean 'isHome' to true if the current path is '/home'.
Lines 28-31: Returns an 'aside' element serving as the sidebar container, applying Tailwind classes for layout, borders, and backdrop blurring using the 'tc' prop.
Lines 33-45: Renders the RideWise logo and icon. Adds an onClick handler to navigate to '/home' when clicked.
Lines 47-49: Wraps the main navigation links in a 'nav' tag.
Lines 51-61: Renders the 'Home' navigation button. It applies active styles (filled and glowing) if 'isHome' is true, and inactive styles otherwise. Clicking it navigates to '/home'.
Lines 63-76: Renders the 'Riders' navigation button. It checks if the location is '/riders' to highlight it and navigates to '/riders' when clicked.
Lines 80-82: Renders the 'AccountMenu' component at the bottom of the sidebar, passing the 'tc' prop to it.
Lines 83-86: Closes the aside, the component, and the file.
"""

explanations["TopBar.jsx_explanation.txt"] = """File: TopBar.jsx
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\components\\layout\\TopBar.jsx
What it does: Renders the top navigation bar for the authenticated layout. It includes mobile logo, desktop search, and action icons.

Lines 1-13: Header comments explaining the layout of the TopBar (left, center, right) and recent changes.
Line 15: Imports 'useEffect', 'useRef', and 'useState' from React.
Line 16: Imports 'useNavigate' from react-router-dom.
Line 17: Imports 'useAuth' from the AuthContext to get the user's avatar letter.
Line 18: Imports the 'ThemeDropdown' component.
Lines 20-26: Defines a constant array 'SEARCH_CATEGORIES' providing suggested filters for the search dropdown.
Lines 28-35: Defines and exports the 'TopBar' component, accepting multiple props including theme details, voice control flags, and notification counts.
Line 36: Initializes 'navigate' from react-router-dom.
Line 37: Destructures 'avatarLetter' from the useAuth hook.
Lines 39-44: Defines local state variables for search inputs and dropdown visibility, and a ref for the search container.
Lines 46-55: A useEffect hook that listens for mousedown events to close the search dropdown when the user clicks outside of the 'searchRef' area.
Lines 57-61: Returns the 'header' HTML element, applying fixed positioning and theme-specific styling.
Lines 63-74: Renders the mobile-only logo block, visible only on small screens. Clicking it navigates to '/home'.
Lines 76-98: Renders the desktop search bar. Includes an input field that updates the 'searchQuery' state. Also shows a clear 'x' button when there's text.
Lines 100-122: Conditionally renders the search dropdown if 'searchOpen' and 'searchQuery' are truthy. It maps over 'SEARCH_CATEGORIES' to display clickable suggestions.
Lines 124-126: Wraps the right-side action icons in a flex container.
Lines 127-133: Renders the mobile search toggle button (visible on small screens).
Lines 135-149: Conditionally renders the voice control button if 'startVoice' is passed. It pulses red if 'voiceMode' is active.
Lines 151-161: Renders the notification bell icon. If 'notificationCount' > 0, it renders a red badge with the number.
Lines 163-164: Renders the 'ThemeDropdown' component.
Lines 166-176: Renders the profile avatar button. Displays the 'avatarLetter' and navigates to '/account' when clicked.
Lines 178-198: Renders a slide-down mobile search bar if 'mobileSearchOpen' is true. It includes an input that listens for the 'Enter' key to execute a search.
Lines 199-201: Closes the main header and the component function.
"""

explanations["MobileNav.jsx_explanation.txt"] = """File: MobileNav.jsx
Location: E:\\My projects\\RideWise\\frontend\\src\\pages\\components\\layout\\MobileNav.jsx
What it does: Renders an ultra-minimal bottom navigation bar for mobile devices, containing Home, a Start Ride FAB, and Account.

Lines 1-11: Header comments explaining the component's simplicity, the three target routes, and the purpose of the central Floating Action Button (FAB).
Line 13: Imports 'useNavigate' and 'useLocation' from react-router-dom.
Line 15: Defines and exports the 'MobileNav' component, taking 'tc' (theme classes) and an 'onStartRide' callback prop.
Lines 16-17: Initializes the 'navigate' and 'location' hooks.
Lines 19-23: Returns a 'nav' element, fixed to the bottom of the screen. The 'lg:hidden' class ensures it is only visible on mobile/tablet sizes.
Lines 25-34: Renders the left 'Home' button. It uses the current location to color the icon orange if active. Clicking it calls 'navigate("/home")'.
Lines 36-48: Renders the center 'Start Ride' FAB. It uses inline styles for a gradient and a shadow to pop out from the bottom bar. Clicking it triggers the 'onStartRide' callback.
Lines 50-59: Renders the right 'Account' button. Highlights orange if the path is '/account', and navigates there when clicked.
Lines 61-65: Closes all HTML tags and ends the component block.
"""

for filename, content in explanations.items():
    filepath = os.path.join(output_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"{filename} size: {os.path.getsize(filepath)} bytes")

print("DONE: Landing and Layout (6/6)")
