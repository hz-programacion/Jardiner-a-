// Source: Google Maps Platform Code Assist (AutocompleteSuggestion.fetchAutocompleteSuggestions & Place.fetchFields)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Navigation, Sparkles } from 'lucide-react';
import {
  ClientProperty,
  LatLng,
  StreetSuggestionItem,
} from '../types/lawn';
import { getStreetAddressSuggestions } from '../utils/lawnLogic';
import { VoiceDictationButton } from './AccessibilityVoiceBar';
import { speakTextInSpanish } from '../utils/accessibilityAndVoice';

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
  placeholder = 'Escribe la calle (ej. Av. Casey 1240, Chacabuco 920, Los Aromos...)',
  onChange,
  onSelectSuggestion,
}: StreetAddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [googleSuggestions, setGoogleSuggestions] = useState<
    StreetSuggestionItem[]
  >([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<any>(null);

  // Instant zero-latency local catalog + dynamic house number suggestions
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
        input: `${trimmed}, ${activeCity}`,
        sessionToken: sessionTokenRef.current,
        language: 'es',
        region: 'ar',
      };

      gPlaces.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res: any) => {
          if (cancelled) return;
          const preds = res?.suggestions || [];
          const mapped: StreetSuggestionItem[] = [];
          for (let i = 0; i < Math.min(preds.length, 3); i++) {
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
              neighborhood: `${cityPart} - Centro`,
              city: activeCity,
              coordinates: baseCoordinates || { lat: -33.7456, lng: -61.9688 },
              source: 'google_places',
              // Keep reference to placePrediction for Place.fetchFields on selection
              ...(pred ? { _rawPrediction: pred } : {}),
            } as StreetSuggestionItem);
          }
          setGoogleSuggestions(mapped);
        })
        .catch((err: any) => {
          const msg = String(err?.message || err || '');
          if (
            msg.includes('OVER_QUERY_LIMIT') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('429')
          ) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        });
    } catch {
      // Fallback silently to localSuggestions
    }

    return () => {
      cancelled = true;
    };
  }, [value, activeCity, baseCoordinates]);

  const combinedSuggestions = useMemo(() => {
    const merged: StreetSuggestionItem[] = [...localSuggestions];
    const seen = new Set(
      merged.map((m) => m.streetAddress.toLowerCase().trim())
    );
    for (const g of googleSuggestions) {
      const key = g.streetAddress.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(g);
      }
    }
    return merged.slice(0, 7);
  }, [localSuggestions, googleSuggestions]);

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
    speakTextInSpanish(`Calle seleccionada: ${item.streetAddress}`);

    // If this suggestion came from Google Places API (New), fetch exact coordinates via Place.fetchFields
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
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1"
        >
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <MapPin className="w-4 h-4 text-emerald-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={id}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          />
        </div>
        <VoiceDictationButton
          fieldLabel="la calle o dirección"
          onTranscript={(txt) => {
            onChange(txt);
            setIsOpen(true);
          }}
          quickOptions={combinedSuggestions.slice(0, 6).map((s) => ({
            emoji: '📍',
            label: `${s.streetAddress} (${s.neighborhood})`,
            value: s.streetAddress,
          }))}
        />
      </div>

      {isOpen && combinedSuggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Sugerencias de calles y direcciones"
          className="absolute left-0 z-50 mt-1.5 w-full min-w-[290px] sm:min-w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="px-3.5 py-2 bg-emerald-50/90 border-b border-emerald-100 flex items-center justify-between text-[11px] font-bold text-emerald-900">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Tocá una calle sugerida para evitar errores:</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-700 shrink-0 ml-2">
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
                    onClick={() => handleChooseSuggestion(item)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted
                        ? 'bg-emerald-50/90 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <Navigation className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                          {item.streetAddress}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-snug">
                          {item.neighborhood}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isExactMatch ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          <span>Elegida</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700">
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
