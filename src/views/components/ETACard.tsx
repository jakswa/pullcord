export interface ETACardProps {
  headsign: string;
  etaMinutes: number;
  vehicleId?: string;
  staleSeconds: number;
  isStale?: boolean;
}

export const ETACard = (props: ETACardProps) => {
  const { headsign, etaMinutes, vehicleId, staleSeconds, isStale = false } = props;
  
  const formatETA = (minutes: number): string => {
    if (minutes < 1) return "Now";
    if (minutes === 1) return "1 min";
    return `${minutes} min`;
  };

  const formatStaleness = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return "1 min ago";
    return `${minutes} min ago`;
  };

  const stalenessClass = (): string => {
    if (staleSeconds < 60) return "text-green-600";
    if (staleSeconds < 300) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div class={`rounded-lg border bg-white p-4 ${isStale ? 'border-red-200' : 'border-gray-200'}`}>
      <div class="mb-2 flex items-start justify-between">
        <div class="flex-1 text-sm font-medium text-gray-900">
          → {headsign}
        </div>
        <div class="ml-4 text-2xl font-bold text-blue-600">
          {formatETA(etaMinutes)}
        </div>
      </div>
      
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
