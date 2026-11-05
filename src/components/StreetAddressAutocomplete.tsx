// Source: Google Maps Platform Code Assist & Federal Argentina Predictive Autocomplete
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Compass, MapPin, Navigation, Search } from 'lucide-react';
import {
  ArgentinaCitySuggestion,
  ClientProperty,
  LatLng,
  StreetSuggestionItem,
} from '../types/lawn';
import {
  getArgentinaCitySuggestions,
  getStreetAddressSuggestions,
} from '../utils/lawnLogic';

interface CityAutocompleteProps {
  id?: string;
  label?: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  onChange: (newCityValue: string) => void;
  onSelectCity: (citySuggestion: ArgentinaCitySuggestion) => void;
}

/**
 * Predictive Google Maps-style City & Locality Autocomplete for all of Argentina.
 * Anticipates partial inputs (e.g. typing "Venado" recommends "Venado Tuerto, Santa Fe" with GPS coordinates).
 */
export function CityAutocomplete({
  id = 'argentina-city-autocomplete',
  label,
  value,
  placeholder = 'Ej. Escribí "Venado", "Rosario", "Córdoba", "Pilar", "Tandil"...',
  helperText,
  onChange,
  onSelectCity,
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [remoteCities, setRemoteCities] = useState<ArgentinaCitySuggestion[]>(
    []
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const localCitySuggestions = useMemo(
    () => getArgentinaCitySuggestions(value, 8),
    [value]
  );

  // Live Argentina locality lookup fallback for any town/village in Argentina
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setRemoteCities([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar,co,uy,cl,py,mx,pe,es&addressdetails=1&limit=5&q=${encodeURIComponent(
          trimmed
        )}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'es' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const mapped: ArgentinaCitySuggestion[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const addr = item?.address || {};
          const cityName =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.suburb ||
            (item.display_name ? String(item.display_name).split(',')[0] : '');
          const stateName = addr.state || 'Argentina';
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!cityName || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            continue;
          }
          const fullName = `${cityName.trim()}, ${stateName.trim()}`;
          mapped.push({
            id: `nom-city-${i}-${cityName}`,
            city: cityName.trim(),
            province: stateName.trim(),
            fullName,
            defaultAddress: `Av. San Martín 500, ${cityName.trim()}`,
            coordinates: {
              lat: Math.round(lat * 10000) / 10000,
              lng: Math.round(lon * 10000) / 10000,
            },
          });
        }
        setRemoteCities(mapped);
      } catch {
        // Ignore network or abort errors; local catalog always works offline
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const combinedCities = useMemo(() => {
    const merged: ArgentinaCitySuggestion[] = [...localCitySuggestions];
    const seen = new Set(merged.map((c) => c.fullName.toLowerCase().trim()));
    for (const r of remoteCities) {
      const k = r.fullName.toLowerCase().trim();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(r);
      }
    }
    return merged.slice(0, 8);
  }, [localCitySuggestions, remoteCities]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChooseCity = (item: ArgentinaCitySuggestion) => {
    onChange(item.fullName);
    onSelectCity(item);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || combinedCities.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % combinedCities.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev - 1 < 0 ? combinedCities.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && isOpen) {
      const target = combinedCities[highlightedIndex];
      if (target) {
        e.preventDefault();
        handleChooseCity(target);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <Compass className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              const trimmed = value.trim();
              if (trimmed.length >= 3 && combinedCities.length > 0) {
                const top = combinedCities[0];
                if (
                  top &&
                  top.fullName.toLowerCase() !== trimmed.toLowerCase() &&
                  top.city.toLowerCase().startsWith(trimmed.toLowerCase())
                ) {
                  onChange(top.fullName);
                  onSelectCity(top);
                }
              }
            }, 150);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white transition-all"
        />
      </div>
      {helperText && (
        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
          {helperText}
        </p>
      )}

      {isOpen && combinedCities.length > 0 && (
        <div
          role="listbox"
          aria-label="Sugerencias de ciudades de Argentina"
          className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-slate-700 flex items-center justify-between text-[11px] font-medium">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">
                Seleccioná la localidad exacta para calibrar el GPS
              </span>
            </span>
            <span className="text-[10px] font-mono text-blue-600 font-semibold shrink-0 ml-2">
              Argentina
            </span>
          </div>

          <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {combinedCities.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isExact =
                value.trim().toLowerCase() === item.fullName.toLowerCase();

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleChooseCity(item)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50/80 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          Provincia: {item.province} · GPS:{' '}
                          {item.coordinates.lat.toFixed(3)},{' '}
                          {item.coordinates.lng.toFixed(3)}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isExact ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          <span>Activa</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-blue-600">
                          Elegir
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

interface StreetAddressAutocompleteProps {
  id?: string;
  label?: string;
  activeNeighborhood?: string;
  value: string;
  activeCity: string;
  baseCoordinates?: LatLng;
  existingProperties?: ClientProperty[];
  placeholder?: string;
  onChange: (newValue: string) => void;
  onSelectSuggestion: (suggestion: StreetSuggestionItem) => void;
}

export function StreetAddressAutocomplete({
  id = 'client-address-input',
  label,
  value,
  activeCity,
  baseCoordinates,
  existingProperties = [],
  placeholder = 'Escribí calle y altura (ej. Av. San Martín 650, Casey 450, Los Aromos...)',
  onChange,
  onSelectSuggestion,
}: StreetAddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [googleSuggestions, setGoogleSuggestions] = useState<
    StreetSuggestionItem[]
  >([]);
  const [nominatimSuggestions, setNominatimSuggestions] = useState<
    StreetSuggestionItem[]
  >([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<any>(null);

  // Instant zero-latency local catalog + universal Argentine streets + dynamic house number suggestions
  const localSuggestions = useMemo(
    () => getStreetAddressSuggestions(value, activeCity, existingProperties),
    [value, activeCity, existingProperties]
  );

  // Optional live Google Maps Places API (New) AutocompleteSuggestion.fetchAutocompleteSuggestions
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setGoogleSuggestions([]);
      return;
    }

    const gPlaces = (window as any).google?.maps?.places;
    if (
      !gPlaces ||
      !gPlaces.AutocompleteSuggestion ||
      typeof gPlaces.AutocompleteSuggestion.fetchAutocompleteSuggestions !==
        'function'
    ) {
      return;
    }

    let cancelled = false;
    try {
      if (!sessionTokenRef.current && gPlaces.AutocompleteSessionToken) {
        sessionTokenRef.current = new gPlaces.AutocompleteSessionToken();
      }

      const request: any = {
        input: `${trimmed}, ${activeCity}, Argentina`,
        sessionToken: sessionTokenRef.current,
        language: 'es',
        region: 'ar',
      };

      gPlaces.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res: any) => {
          if (cancelled) return;
          const preds = res?.suggestions || [];
          const mapped: StreetSuggestionItem[] = [];
          for (let i = 0; i < Math.min(preds.length, 4); i++) {
            const pred = preds[i]?.placePrediction;
            if (!pred) continue;
            const fullText: string = pred.text?.text || '';
            if (!fullText) continue;
            const parts = fullText.split(',').map((s: string) => s.trim());
            const streetPart = parts[0] || trimmed;
            const cityPart = parts[1] || activeCity.split(',')[0].trim();

            mapped.push({
              id: `gmp-sug-${i}-${streetPart}`,
              streetAddress: streetPart,
              neighborhood: `${cityPart} - Urbano`,
              city: activeCity,
              coordinates: baseCoordinates || { lat: -33.7456, lng: -61.9688 },
              source: 'google_places',
              ...(pred ? { _rawPrediction: pred } : {}),
            } as StreetSuggestionItem);
          }
          setGoogleSuggestions(mapped);
        })
        .catch(() => {
          // Fallback silently
        });
    } catch {
      // Fallback silently
    }

    return () => {
      cancelled = true;
    };
  }, [value, activeCity, baseCoordinates]);

  // Live Argentina street geocoding fallback via OpenStreetMap Nominatim
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 4) {
      setNominatimSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const cleanCity = (activeCity || 'Argentina').split(',')[0].trim();
        const q = `${trimmed}, ${cleanCity}, Argentina`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&addressdetails=1&limit=3&q=${encodeURIComponent(
          q
        )}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'es' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const mapped: StreetSuggestionItem[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const addr = item?.address || {};
          const road =
            addr.road ||
            addr.pedestrian ||
            (item.display_name ? String(item.display_name).split(',')[0] : '');
          const houseNum = addr.house_number || '';
          const cityLabel =
            addr.city || addr.town || addr.village || cleanCity;
          const suburb = addr.suburb || addr.neighbourhood || 'Centro';
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!road || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          const typedNumberMatch = trimmed.match(/\b(\d{1,5})\b/);
          const finalNum = houseNum || (typedNumberMatch ? typedNumberMatch[1] : '');
          const streetAddress = finalNum ? `${road} ${finalNum}` : road;

          mapped.push({
            id: `nom-street-${i}-${streetAddress}`,
            streetAddress,
            neighborhood: `${cityLabel} - ${suburb}`,
            city: activeCity,
            coordinates: {
              lat: Math.round(lat * 10000) / 10000,
              lng: Math.round(lon * 10000) / 10000,
            },
            source: 'google_places',
          });
        }
        setNominatimSuggestions(mapped);
      } catch {
        // Ignore network errors
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, activeCity]);

  const combinedSuggestions = useMemo(() => {
    const merged: StreetSuggestionItem[] = [];
    const seen = new Set<string>();

    const pushUnique = (list: StreetSuggestionItem[]) => {
      for (const item of list) {
        const key = item.streetAddress.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
    };

    pushUnique(googleSuggestions);
    pushUnique(nominatimSuggestions);
    pushUnique(localSuggestions);

    return merged.slice(0, 7);
  }, [localSuggestions, googleSuggestions, nominatimSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChooseSuggestion = async (item: StreetSuggestionItem) => {
    onChange(item.streetAddress);
    setIsOpen(false);

    const rawPred = (item as any)._rawPrediction;
    if (rawPred && typeof rawPred.toPlace === 'function') {
      try {
        const place = rawPred.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        sessionTokenRef.current = null;
        if (place.location) {
          const lat =
            typeof place.location.lat === 'function'
              ? place.location.lat()
              : place.location.lat;
          const lng =
            typeof place.location.lng === 'function'
              ? place.location.lng()
              : place.location.lng;
          if (typeof lat === 'number' && typeof lng === 'number') {
            onSelectSuggestion({
              ...item,
              coordinates: {
                lat: Math.round(lat * 10000) / 10000,
                lng: Math.round(lng * 10000) / 10000,
              },
            });
            return;
          }
        }
      } catch {
        // Fallback to item coordinates
      }
    }

    onSelectSuggestion(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || combinedSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % combinedSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev - 1 < 0 ? combinedSuggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && isOpen) {
      const target = combinedSuggestions[highlightedIndex];
      if (target) {
        e.preventDefault();
        handleChooseSuggestion(target);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative flex-1 min-w-0">
        <MapPin className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white transition-all"
        />
      </div>

      {isOpen && combinedSuggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Sugerencias de calles y direcciones"
          className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-slate-700 flex items-center justify-between text-[11px] font-medium">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">
                Elegí la dirección recomendada para fijar el GPS exacto
              </span>
            </span>
            <span className="font-mono text-[10px] text-blue-600 font-semibold shrink-0 ml-2">
              {activeCity.split(',')[0]}
            </span>
          </div>

          <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {combinedSuggestions.map((item, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isExactMatch =
                value.trim().toLowerCase() ===
                item.streetAddress.toLowerCase();

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleChooseSuggestion(item)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted
                        ? 'bg-blue-50/80 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.streetAddress}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {item.neighborhood} · {item.city}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isExactMatch ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          <span>Elegida</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-blue-600">
                          Elegir
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

