import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  ExternalLink,
  MapPin,
  Navigation,
  Route as RouteIcon,
} from 'lucide-react';
import { BaseLocationConfig, LatLng, ScheduledJob } from '../types/lawn';
import { buildGoogleMapsNavUrl } from '../utils/lawnLogic';

declare const google: any;

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

interface RouteOverlayProps {
  baseLocation: LatLng;
  jobs: ScheduledJob[];
  selectedJobId: string | null;
  onRouteComputed?: (
    metrics: { distanceKm: number; durationMin: number } | null
  ) => void;
}

function RoutePolylineController({
  baseLocation,
  jobs,
  selectedJobId,
  onRouteComputed,
}: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (jobs.length === 0) {
      map.panTo(baseLocation);
      onRouteComputed?.(null);
      return;
    }

    const drawDirectFallbackLine = () => {
      const pathCoords: LatLng[] = [
        baseLocation,
        ...jobs.map((j) => j.coordinates),
      ];
      const fallbackLine = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#059669',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      polylinesRef.current.push(fallbackLine);

      const bounds = new google.maps.LatLngBounds();
      pathCoords.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, 48);
    };

    if (!routesLib || !(routesLib as any).Route) {
      drawDirectFallbackLine();
      return;
    }

    const destinationJob = jobs[jobs.length - 1];
    const intermediateJobs = jobs.slice(0, -1);

    const request: any = {
      origin: baseLocation,
      destination: destinationJob.coordinates,
      intermediates: intermediateJobs.map((j) => ({
        location: j.coordinates,
      })),
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    let cancelled = false;

    try {
      const routeClass = (routesLib as any).Route;
      if (typeof routeClass.computeRoutes === 'function') {
        routeClass
          .computeRoutes(request)
          .then((res: any) => {
            if (cancelled) return;
            const routes = res?.routes;
            if (!routes || routes.length === 0) {
              drawDirectFallbackLine();
              return;
            }
            const primaryRoute = routes[0];
            if (typeof primaryRoute.createPolylines === 'function') {
              const newPolylines = primaryRoute.createPolylines();
              newPolylines.forEach((polyline: any) => {
                polyline.setOptions({
                  strokeColor: '#059669',
                  strokeOpacity: 0.94,
                  strokeWeight: 5,
                });
                polyline.setMap(map);
              });
              polylinesRef.current = newPolylines;
            } else {
              drawDirectFallbackLine();
            }

            if (primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport, 48);
            }

            if (primaryRoute.distanceMeters && primaryRoute.durationMillis) {
              onRouteComputed?.({
                distanceKm:
                  Math.round((primaryRoute.distanceMeters / 1000) * 10) / 10,
                durationMin: Math.round(primaryRoute.durationMillis / 60000),
              });
            }
          })
          .catch((err: any) => {
            if (cancelled) return;
            const msg = String(err?.message || err || '');
            if (
              msg.includes('OVER_QUERY_LIMIT') ||
              msg.includes('RESOURCE_EXHAUSTED') ||
              msg.includes('429') ||
              msg.includes('Quota')
            ) {
              window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            }
            drawDirectFallbackLine();
          });
      } else {
        drawDirectFallbackLine();
      }
    } catch {
      drawDirectFallbackLine();
    }

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, baseLocation, jobs]);

  useEffect(() => {
    if (!map || !selectedJobId) return;
    const found = jobs.find((j) => j.id === selectedJobId);
    if (found) {
      map.panTo(found.coordinates);
    }
  }, [map, selectedJobId, jobs]);

  return null;
}

interface RouteMapPanelProps {
  baseLocation: BaseLocationConfig;
  activeDate: string;
  jobs: ScheduledJob[];
  selectedJobId: string | null;
  isLocatingGps?: boolean;
  onSelectJob: (jobId: string) => void;
  onStartQuickComplete: (job: ScheduledJob) => void;
  onOpenBaseModal: () => void;
  onUseCurrentGps: () => void;
}

export function RouteMapPanel({
  baseLocation,
  activeDate,
  jobs,
  selectedJobId,
  isLocatingGps = false,
  onSelectJob,
  onStartQuickComplete,
  onOpenBaseModal,
  onUseCurrentGps,
}: RouteMapPanelProps) {
  const [liveRouteStats, setLiveRouteStats] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [infoWindowJobId, setInfoWindowJobId] = useState<string | null>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;
  const infoWindowJob = jobs.find((j) => j.id === infoWindowJobId) || null;

  const fullItineraryUrl =
    jobs.length > 0
      ? buildGoogleMapsNavUrl(
          jobs[jobs.length - 1].coordinates,
          jobs.slice(0, -1).map((j) => j.coordinates)
        )
      : buildGoogleMapsNavUrl(baseLocation.coordinates);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
      {/* Map Header Bar with Dynamic Base Controls */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70 text-slate-900">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Cartografía y Ruta GPS de Lotes
            </h2>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold tabular-nums">
              {liveRouteStats
                ? `${liveRouteStats.distanceKm} km (~${liveRouteStats.durationMin} min)`
                : `${jobs.length} paradas`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums truncate">
            Punto de salida:{' '}
            <button
              type="button"
              onClick={onOpenBaseModal}
              className="font-semibold text-slate-900 hover:text-emerald-700 underline cursor-pointer"
            >
              {baseLocation.city} ({baseLocation.address})
            </button>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUseCurrentGps}
            disabled={isLocatingGps}
            title="Tomar mi ubicación actual por GPS como punto de salida"
            className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer shadow-2xs"
          >
            <Crosshair
              className={`w-3.5 h-3.5 text-emerald-600 ${
                isLocatingGps ? 'animate-spin' : ''
              }`}
            />
            <span>{isLocatingGps ? 'Ubicando...' : 'Mi GPS'}</span>
          </button>

          <a
            href={fullItineraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            <RouteIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Abrir Ruta</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div
        className="relative w-full h-[360px] lg:h-[460px] bg-slate-100 [&_.gm-style]:saturate-[0.9]"
        data-testid="google-map-container"
      >
        <APIProvider apiKey={API_KEY}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={baseLocation.coordinates}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            fullscreenControl={false}
            streetViewControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            {/* Dynamic Base / Starting Point Marker */}
            <AdvancedMarker
              position={baseLocation.coordinates}
              title={`${baseLocation.name}: ${baseLocation.address}, ${baseLocation.city}`}
              onClick={onOpenBaseModal}
            >
              <button
                type="button"
                onClick={onOpenBaseModal}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-mono font-bold shadow-md border border-white flex items-center gap-1.5"
              >
                <Crosshair className="w-3 h-3 text-emerald-400" />
                <span>BASE: {baseLocation.city.toUpperCase()}</span>
              </button>
            </AdvancedMarker>

            {/* Numbered Stop Markers — Architectural Slate & Emerald Hierarchy */}
            {jobs.map((job, index) => {
              const isSelected = job.id === selectedJobId;
              const isCompleted = job.status === 'Completado';

              const bgClass = isSelected
                ? 'bg-emerald-600 text-white border-white ring-2 ring-emerald-600/35'
                : isCompleted
                ? 'bg-white text-slate-600 border-slate-300'
                : 'bg-slate-900 text-white border-white';

              return (
                <AdvancedMarker
                  key={job.id}
                  position={job.coordinates}
                  title={`${index + 1}. ${job.scheduledTime} — ${job.clientName} (${job.address})`}
                  onClick={() => {
                    onSelectJob(job.id);
                    setInfoWindowJobId(job.id);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectJob(job.id);
                      setInfoWindowJobId(job.id);
                    }}
                    aria-label={`Parada ${index + 1}: ${job.clientName}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-md font-mono text-xs font-semibold transition-transform ${
                      isSelected ? 'scale-105' : 'hover:scale-105'
                    } ${bgClass}`}
                  >
                    <span>#{index + 1}</span>
                    <span className="text-[11px] opacity-80">
                      {job.scheduledTime}
                    </span>
                    <span className="font-sans font-semibold max-w-[100px] truncate">
                      {job.clientName.split(' ')[0]}
                    </span>
                  </button>
                </AdvancedMarker>
              );
            })}

            {/* Selected Stop InfoWindow */}
            {infoWindowJob && (
              <InfoWindow
                position={infoWindowJob.coordinates}
                onCloseClick={() => setInfoWindowJobId(null)}
              >
                <div className="p-1 max-w-[240px] text-slate-900">
                  <div className="text-xs text-slate-500 font-mono">
                    #{infoWindowJob.orderIndex} · {infoWindowJob.scheduledTime} hs ·{' '}
                    {infoWindowJob.propertyType} ({infoWindowJob.areaSqm} m²)
                  </div>
                  <div className="text-sm font-bold text-slate-950 mt-0.5">
                    {infoWindowJob.clientName}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {infoWindowJob.address}, {infoWindowJob.neighborhood}
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700 mt-1 tabular-nums">
                    ${infoWindowJob.price.toLocaleString('es-AR')}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <a
                      href={buildGoogleMapsNavUrl(infoWindowJob.coordinates)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Cómo llegar</span>
                    </a>
                    {infoWindowJob.status !== 'Completado' && (
                      <button
                        type="button"
                        onClick={() => onStartQuickComplete(infoWindowJob)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 whitespace-nowrap"
                      >
                        Completar
                      </button>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}

            <RoutePolylineController
              baseLocation={baseLocation.coordinates}
              jobs={jobs}
              selectedJobId={selectedJobId}
              onRouteComputed={setLiveRouteStats}
            />
          </Map>
        </APIProvider>
      </div>

      {/* Selected Stop Quick Navigation Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        {selectedJob ? (
          <>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                Parada #{selectedJob.orderIndex} · {selectedJob.scheduledTime} hs ·{' '}
                {selectedJob.propertyType} ({selectedJob.areaSqm} m²) · $
                {selectedJob.price.toLocaleString('es-AR')}
              </div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {selectedJob.clientName} — {selectedJob.address} ({selectedJob.neighborhood})
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={buildGoogleMapsNavUrl(selectedJob.coordinates)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                <span>Navegar a Parada</span>
              </a>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-600">
            Seleccioná cualquier orden en la lista o el mapa para ver su dirección en {baseLocation.city}.
          </div>
        )}
      </div>
    </div>
  );
}
