import os

out_dir = r"E:\My projects\RideWise\Project Details\frontend"
os.makedirs(out_dir, exist_ok=True)

home = """File: Home.jsx
Location: frontend\\src\\pages\\Home.jsx
What it does: Main dashboard for a rider. Shows current active ride, recent rides, stats, tip of the day, and allows starting new rides via modals.

Lines 1-30: Comments explaining what the file manages (hero section, ride history, modals), its state, data flow, and layout.
Line 32: Imports React hooks (useEffect, useRef, useState, useCallback) for state and lifecycle management.
Lines 33-42: Imports internal context, layout components (MobileNav, Sidebar, TopBar), shared modals, and hooks for voice and theme.
Lines 44-45: Imports API services to get/modify rides and calculate distances/durations.
Line 47: Defines the main Home component.
Lines 48-49: Initializes theme, theme classes (tc), and user context.
Lines 51-54: State variables to control the visibility of the StartRideModal and RideHistoryPanel.
Lines 55-60: State variables for tracking the ride shown on the map (mapRide), all past rides (rides), and loading status.
Lines 62-68: Sets up an effect to track mouse position for a glowing radial background effect. Adds and removes a 'mousemove' event listener.
Lines 70-79: Defines voice commands mapped to functions (e.g., opening modals, changing themes) and initializes the voice hook.
Lines 81-88: Calculates a greeting and corresponding icon based on the current hour of the day.
Lines 90-108: Defines refreshRides function wrapped in useCallback to fetch the user's rides from the API, then calls it on component mount using useEffect.
Lines 110-112: Derives two separate arrays for active rides and past rides from the main rides list.
Lines 114-123: Computes total kilometers ridden and completed rides count, then structures them into a stats array for display.
Lines 125-131: handleRideCreated function: When a new ride is started, opens the map for it and refreshes the ride list.
Lines 133-136: handleCloseMap function: Closes the full-screen map overlay.
Lines 138-153: handleEndRide function: Closes the map, calls the API to mark the ride as completed, and refreshes the ride list.
Lines 155-160: handleOpenRide function: Opens the map for a specific ride and closes the history panel if open.
Lines 162-166: handleDeleteRide function: Calls the API to delete a ride and refreshes the list.
Lines 168-175: Defines an array of safety/riding tips and selects one based on the current day of the month.
Lines 177-183: Starts the render method, wrapping the entire page in a div with dynamic theme classes.
Lines 184-190: Renders a decorative radial gradient that follows the user's mouse position.
Lines 192-198: Renders the core layout shell: Sidebar, TopBar, and MobileNav.
Lines 200-210: Main content area, styled to be centered with a maximum width for readability.
Lines 211-244: Hero section rendering the personalized greeting, active riders count, and introductory text with CSS animations.
Lines 246-277: Renders the glowing "Start a Ride" button which opens the modal, along with a tip about voice commands.
Lines 279-300: If there are live rides, maps over them and renders a RideCard for each.
Lines 302-322: Maps over the stats array and renders styled stat cards (Total Rides, Distance, Completed).
Lines 324-373: Recent rides section. Shows up to 3 most recent rides using RideCards. Also includes a button to view the full ride history. Handles a loading skeleton state.
Lines 375-387: Empty state shown when the user has no rides. Prompts them to start one.
Lines 389-409: Tip of the day section rendering the dynamically chosen daily tip.
Lines 418-425: Renders the StartRideModal component, passing state and handlers.
Lines 427-434: Conditionally renders the ActiveRideOverlay if a mapRide is selected.
Lines 436-445: Conditionally renders the RideHistoryPanel if showHistory is true.
Lines 447-462: Injects inline CSS styles for custom animations (glow, ring-pulse, slideUp).
Lines 467-531: Defines the RideCard functional component used to display individual rides in lists. Extracts short names, formats dates, and renders icons/metrics based on whether the ride is live or past."""

riders = """File: Riders.jsx
Location: frontend\\src\\pages\\Riders.jsx
What it does: Page for managing rider connections (adding, removing, and finding nearby riders).

Lines 1-9: Comments explaining the file purpose, route, and safety precautions.
Lines 11-23: Imports React hooks, theme/auth context, layout components, and rider API services.
Line 25: Defines the Riders component.
Lines 26-27: Extracts theme and user context.
Line 29-38: State variables for the current view (all/add/remove/near), connections list, nearby riders, search functionality, loading, and toast messages.
Line 40: Extracts the current user's ID.
Lines 42-43: Creates a Set of connected rider IDs for quick O(1) lookup during rendering.
Lines 45-61: reloadConnections function fetches the full list of connections from the API and saves to state. useEffect calls this when user ID changes.
Lines 63-75: loadNearRiders function fetches riders near the current user's location from the API and handles loading state.
Lines 77-97: Sets up a debounced effect that searches riders based on the searchQuery input when in the "add" view. Clears search results if query is empty.
Lines 99-103: showToast function displays a temporary message on screen for 2.5 seconds.
Lines 105-118: handleAdd function: Calls API to add a connection, shows success/error toast, and refreshes connections.
Lines 120-133: handleRemove function: Calls API to remove a connection, shows a toast, and refreshes connections.
Lines 135-186: Defines the internal RiderCard component. Renders the rider's avatar, name, email, distance (if available), and Add/Remove buttons depending on props and connection status.
Lines 188-195: Defines the internal EmptyState component used to show placeholder content when lists are empty.
Lines 197-201: Main render starts here. Renders the layout shell components (Sidebar, TopBar, MobileNav).
Lines 203-212: Main content wrapper and page header title/description.
Lines 214-261: Three main CTA buttons (Add Rider, Remove Rider, Near Riders). Clicking them toggles the current view and loads data if needed (e.g., near riders).
Lines 263-268: Conditionally renders the toast message if one is active.
Lines 270-312: Renders the "add" view section. Contains a search input field. Displays empty state, loading spinner, or a list of search results via RiderCard based on search state.
Lines 314-336: Renders the "remove" view section. Shows loading spinner, empty state, or lists the user's connections with "Remove" buttons.
Lines 338-361: Renders the "near" view section. Displays riders within 50km based on the API response.
Lines 363-397: Always-visible "Your connections" section. Shows the total count and lists all connected riders, with a manual refresh button.
Lines 398-402: Closes all main HTML tags and exports the component."""

account = """File: Account.jsx
Location: frontend\\src\\pages\\Account.jsx
What it does: User profile page allowing the user to view and edit their profile details.

Lines 1-22: Comments detailing the sections, edit mode behavior, and backend-readiness.
Lines 24-29: Imports React hooks, context, and layout components.
Lines 31-92: Defines a reusable Field component for form inputs. It toggles between displaying raw text or an input/textarea based on the 'editing' prop, which prevents focus loss during re-renders.
Line 94: Defines the Account component.
Lines 95-96: Extracts theme and authentication contexts.
Lines 98-106: State variables for editing mode, profile fields (username, mobile, address), loading/saving status, and error messages.
Lines 108-116: useEffect synchronizes local state with the user object from AuthContext whenever the user object updates.
Lines 118-134: handleSave function: Validates username, calls AuthContext updateProfile to save changes, and toggles edit mode off.
Lines 136-143: handleCancel function: Reverts local states back to the original user object values and exits edit mode.
Lines 145-150: Mock statistics array for UI display.
Lines 152-159: Main layout structure wrapping Sidebar, TopBar, MobileNav, and main content area.
Lines 161-171: Renders the gradient cover banner with a decorative dotted pattern.
Lines 173-193: Renders the user's avatar (using avatarLetter) overlapping the banner, along with username and join date.
Lines 195-227: Renders action buttons. Shows "Edit Profile" normally, or "Cancel" and "Save" when in edit mode.
Lines 229-234: Conditionally renders error messages if validation or saving fails.
Lines 236-248: Maps over the stats array to render statistic cards for Rides, Followers, and Following.
Lines 250-299: Profile details card containing editable fields. Uses the Field component for Username, Mobile, and Address. The Email field is hardcoded as read-only.
Lines 301-318: Account actions section providing a "Log out" button that calls the logout function from AuthContext.
Lines 319-323: Closes HTML tags and exports the component."""

settings = """File: Settings.jsx
Location: frontend\\src\\pages\\Settings.jsx
What it does: Allows users to change app theme, accessibility preferences, notifications, and privacy options.

Lines 1-20: File header comments explaining sections, behavior, and how to connect to a backend later.
Lines 21-25: Imports React, theme hook, and layout components.
Lines 27-55: Defines a reusable Toggle component that renders a label, sub-label, and an animated toggle switch switch button.
Lines 57-68: Defines a SectionHeader component for styling consistent headings with icons across settings sections.
Line 70: Defines the Settings component.
Line 72: Extracts theme state and theme options from useTheme hook.
Lines 74-77: State variables for accessibility options (text size, reduce motion, high contrast).
Lines 79-82: State variables for notification preferences.
Lines 84-86: State variables for privacy settings (public profile, online status).
Lines 88-94: Array defining available theme options (dark, light, warm, midnight).
Lines 96-103: Renders layout shell with Sidebar, TopBar, MobileNav, and main content wrapper.
Lines 104-108: Page header displaying title and subtitle.
Lines 110-138: Appearance section. Uses SectionHeader, then maps over themeOptions to render selectable buttons that change the active theme via setTheme.
Lines 140-182: Accessibility section. Features a custom button group for Text Size (small/medium/large) and uses the Toggle component for Reduce Motion and High Contrast settings.
Lines 184-215: Notifications section. Uses the Toggle component for Ride Alerts, Messages, and Community Updates.
Lines 217-240: Privacy section. Uses Toggle components for controlling Public Profile and Show Online Status.
Lines 242-245: Renders a small footer with the app version text.
Lines 246-250: Closes remaining tags and exports."""

onboarding = """File: Onboarding.jsx
Location: frontend\\src\\pages\\Onboarding.jsx
What it does: A sequential form for new users to fill out username, mobile, and address before accessing the app.

Lines 1-22: File comments explaining who sees this page, the steps involved, flow, and backend integration.
Lines 24-27: Imports React hooks, react-router navigation, auth, and theme contexts.
Line 29: Defines the Onboarding component.
Lines 30-32: Initializes navigation and context hooks.
Lines 34-36: State tracking the current onboarding step (1 to 3).
Lines 38-41: State variables for form fields (username, mobile, address).
Lines 43-45: UI state variables for loading and error messaging.
Line 47-48: Regex validation to check if the username contains only alphanumeric characters and underscores (3-20 chars).
Lines 50-151: Array of step objects (steps). Each object contains the icon, title, subtitle, and the JSX input field for that step. Step 1 includes live username validation. Step 2 asks for mobile. Step 3 asks for address via textarea.
Line 153: Derives the current step object from the step state variable.
Lines 155-184: handleNext function. Validates step 1. If not the final step, increments step counter. If final step, calls updateProfile to save and navigates to "/home".
Lines 186-202: handleSkip function. Similar to handleNext but skips validation on optional fields and just moves forward or saves and finishes.
Lines 204-220: Begins rendering. Features a gradient background glow and the RideWise logo header.
Lines 222-239: Progress indicator. Renders a dynamic bar graph and text label showing the current step out of total steps.
Lines 241-262: Main card container. Renders the current step's icon, title, subtitle, and any error message.
Line 262: Injects the specific input field JSX for the current step.
Lines 264-293: Renders the action buttons. A "Skip for now" button appears on steps 2 and 3. A dynamic "Continue/Finish" button calls handleNext.
Lines 296-309: Renders step dot indicators at the bottom for alternative visual progression.
Lines 312-319: Renders a footer note and closes all component tags."""

files = {
    "Home.jsx_explanation.txt": home,
    "Riders.jsx_explanation.txt": riders,
    "Account.jsx_explanation.txt": account,
    "Settings.jsx_explanation.txt": settings,
    "Onboarding.jsx_explanation.txt": onboarding,
}

for name, content in files.items():
    path = os.path.join(out_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"File {name} size: {os.path.getsize(path)} bytes")
