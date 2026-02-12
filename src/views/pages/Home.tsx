export interface HomePageProps {
  // No props needed for now - this will be a client-side interactive page
}

export const HomePage = (props: HomePageProps) => (
  <div class="min-h-screen bg-gray-50">
    {/* Header */}
    <header class="bg-gray-900 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center">
          <span class="text-3xl mr-3">🚌</span>
          <div>
            <h1 class="text-3xl font-bold">Pullcord</h1>
            <p class="text-gray-300">Real-time MARTA bus tracker</p>
          </div>
        </div>
      </div>
    </header>

    {/* Main content */}
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search section */}
      <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Find Your Bus Stop</h2>
        
        {/* Search bar */}
        <div class="mb-6">
          <label htmlFor="stop-search" class="block text-sm font-medium text-gray-700 mb-2">
            Search by stop name
          </label>
          <div class="relative">
            <input
              type="text"
              id="stop-search"
              class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Peachtree, Five Points, North Avenue..."
              autocomplete="off"
            />
            <div class="absolute right-3 top-3">
              <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Location button */}
        <div class="text-center mb-6">
          <div class="text-sm text-gray-500 mb-3">Or</div>
          <button
            id="location-btn"
            class="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Use My Location
          </button>
        </div>

        {/* Results container */}
        <div id="search-results" class="hidden">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Nearby Stops</h3>
          <div id="results-list" class="space-y-3">
            {/* Results will be populated by JavaScript */}
          </div>
        </div>

        {/* Loading state */}
        <div id="search-loading" class="hidden text-center py-8">
          <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-gray-600">Finding stops near you...</p>
        </div>
      </div>

      {/* Info section */}
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
          <ol class="space-y-2 text-sm text-gray-600">
            <li class="flex items-start">
              <span class="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center mr-3 mt-0.5">1</span>
              Search for your bus stop by name or location
            </li>
            <li class="flex items-start">
              <span class="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center mr-3 mt-0.5">2</span>
              Select your stop and route
            </li>
            <li class="flex items-start">
              <span class="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center mr-3 mt-0.5">3</span>
              See real-time bus positions and arrival times
            </li>
          </ol>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">About Pullcord</h3>
          <p class="text-sm text-gray-600 mb-3">
            Pullcord provides real-time MARTA bus tracking with live GPS positions 
            and arrival predictions. Data is updated every 30 seconds directly from 
            MARTA's official feeds.
          </p>
          <p class="text-xs text-gray-500">
            Built with MARTA's GTFS and GTFS-Realtime data feeds.
          </p>
        </div>
      </div>
    </main>

    {/* Client-side functionality will be added via app.js */}
  </div>
);