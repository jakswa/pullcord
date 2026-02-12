export interface ETACardProps {
  headsign: string;
  etaMinutes: number;
  vehicleId?: string;
  staleSeconds: number;
  isStale?: boolean;
}

export const ETACard = (props: ETACardProps) => {
  const { headsign, etaMinutes, vehicleId, staleSeconds, isStale = false } = props;
  
  // Format ETA display
  const formatETA = (minutes: number): string => {
    if (minutes < 1) return "Now";
    if (minutes === 1) return "1 min";
    return `${minutes} min`;
  };

  // Format staleness
  const formatStaleness = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return "1 min ago";
    return `${minutes} min ago`;
  };

  // Determine staleness class
  const stalenessClass = (): string => {
    if (staleSeconds < 60) return "text-green-600"; // Fresh
    if (staleSeconds < 300) return "text-yellow-600"; // Moderate
    return "text-red-600"; // Stale
  };

  return (
    <div class={`bg-white border rounded-lg p-4 ${isStale ? 'border-red-200' : 'border-gray-200'}`}>
      {/* Headsign */}
      <div class="flex items-start justify-between mb-2">
        <div class="text-sm font-medium text-gray-900 flex-1">
          → {headsign}
        </div>
        <div class="text-2xl font-bold text-blue-600 ml-4">
          {formatETA(etaMinutes)}
        </div>
      </div>
      
      {/* Details */}
      <div class="flex items-center justify-between text-xs text-gray-500">
        <div>
          {vehicleId && (
            <span>Bus {vehicleId}</span>
          )}
        </div>
        <div class={stalenessClass()}>
          Updated {formatStaleness(staleSeconds)}
        </div>
      </div>
    </div>
  );
};