import type { Route, Stop, RouteDetail } from "../../data/db.js";

export interface BusTrackerPageProps {
  route: Route;
  stop: Stop;
  routeDetail: RouteDetail;
  initialData: any; // JSON data for client-side initialization
}

export const BusTrackerPage = (props: BusTrackerPageProps) => {
  const { route, stop, routeDetail, initialData } = props;
  
  return (
    <div class="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header class="bg-gray-900 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <a href="/" class="text-2xl mr-3 hover:text-gray-300">🚌</a>
              <div>
                <h1 class="text-xl font-bold">
                  Route {route.route_short_name}
                </h1>
                <p class="text-sm text-gray-300">{route.route_long_name}</p>
              </div>
            </div>
            
            <div class="text-right">
              <p class="text-sm font-medium">{stop.stop_name}</p>
              <div id="last-updated" class="text-xs text-gray-400">
                Loading...
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div class="flex-1 flex flex-col lg:flex-row">
        {/* Map container */}
        <div class="flex-1 relative">
          <div id="map" class="w-full h-96 lg:h-full bg-gray-200">
            {/* Map will be initialized by JavaScript */}
          </div>
          
          {/* Map controls overlay */}
          <div class="absolute top-4 right-4 z-1000">
            <button
              id="recenter-btn"
              class="bg-white shadow-lg rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Center on stop"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          
          {/* Connection status */}
          <div id="connection-status" class="hidden absolute bottom-4 left-4 z-1000">
            <div class="bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-medium">
              ⚠️ Connection lost - retrying...
            </div>
          </div>
        </div>

        {/* ETA sidebar */}
        <div class="w-full lg:w-80 bg-white shadow-lg lg:shadow-none border-t lg:border-t-0 lg:border-l border-gray-200">
          <div class="p-4">
            <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <svg class="h-5 w-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Next Arrivals
            </h2>
            
            {/* ETA cards container */}
            <div id="eta-cards" class="space-y-3">
              {/* Loading state */}
              <div id="eta-loading" class="text-center py-8">
                <svg class="animate-spin h-6 w-6 text-blue-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-gray-600">Loading ETAs...</p>
              </div>
              
              {/* No predictions state */}
              <div id="eta-empty" class="hidden text-center py-8">
                <svg class="h-12 w-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-gray-500 text-sm font-medium">No arrivals predicted</p>
                <p class="text-gray-400 text-xs mt-1">Check back in a few minutes</p>
              </div>
            </div>
            
            {/* Bus count */}
            <div class="mt-6 pt-4 border-t border-gray-100">
              <div id="bus-count" class="text-sm text-gray-600">
                <span id="vehicle-count">-</span> buses on route
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Initial data script */}
      <script dangerouslySetInnerHTML={{ __html: `
        window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
        window.__CONFIG__ = {
          routeId: '${route.route_id}',
          stopId: '${stop.stop_id}',
          pollInterval: 30000
        };
      `}} />
    </div>
  );
};