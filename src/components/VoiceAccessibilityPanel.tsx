import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Mic,
  MicOff,
  Play,
  SlidersHorizontal,
  Square,
  Sun,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  AccessibilityPreferences,
  ParsedVoiceCommand,
  ScheduledJob,
  WeatherForecastDay,
} from '../types/lawn';
import {
  buildDailyRouteSpeechText,
  parseVoiceCommand,
} from '../utils/lawnLogic';

interface VoiceAccessibilityPanelProps {
  activeDate: string;
  todayReferenceStr: string;
  baseCity: string;
  activeDateJobs: ScheduledJob[];
  activeDayWeather: WeatherForecastDay;
  preferences: AccessibilityPreferences;
  isSpeaking: boolean;
  lastVoiceStatus: string | null;
  onUpdatePreferences: (next: AccessibilityPreferences) => void;
  onSpeakText: (text: string) => void;
  onStopSpeaking: () => void;
  onExecuteVoiceCommand: (parsed: ParsedVoiceCommand) => void;
}

const QUICK_VOICE_EXAMPLES = [
  { label: '«Agregar cliente»', phrase: 'Agregar cliente' },
  { label: '«Completar corte»', phrase: 'Completar corte' },
  { label: '«Iniciar corte»', phrase: 'Iniciar corte' },
  { label: '«Cambiar fecha a mañana»', phrase: 'Cambiar fecha a mañana' },
  { label: '«Leer ruta»', phrase: 'Leer ruta' },
  { label: '«Ir a clientes»', phrase: 'Ir a clientes' },
];

export function VoiceAccessibilityPanel({
  activeDate,
  todayReferenceStr,
  baseCity,
  activeDateJobs,
  activeDayWeather,
  preferences,
  isSpeaking,
  lastVoiceStatus,
  onUpdatePreferences,
  onSpeakText,
  onStopSpeaking,
  onExecuteVoiceCommand,
}: VoiceAccessibilityPanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualCommandInput, setManualCommandInput] = useState('');
  const [isAccessibilityModalOpen, setIsAccessibilityModalOpen] =
    useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as any;
    const SpeechRec =
      win.SpeechRecognition || win.webkitSpeechRecognition || null;
    setSpeechSupported(Boolean(SpeechRec));
  }, []);

  // Keyboard shortcut Alt+V to toggle voice listening, Alt+L to read route out loud, Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAccessibilityModalOpen) {
        setIsAccessibilityModalOpen(false);
      } else if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleMicrophoneListening();
      } else if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleReadDailyRoute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const runTranscriptCommand = (phrase: string) => {
    const cleaned = phrase.trim();
    if (!cleaned) return;
    setLiveTranscript(cleaned);
    const parsed = parseVoiceCommand(
      cleaned,
      activeDate,
      activeDateJobs,
      todayReferenceStr
    );
    if (
      parsed.intent === 'ADD_CLIENT' ||
      parsed.intent === 'COMPLETE_JOB' ||
      parsed.intent === 'NAVIGATE_VIEW'
    ) {
      setIsAccessibilityModalOpen(false);
    }
    onExecuteVoiceCommand(parsed);
  };

  const toggleMicrophoneListening = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const win = window as any;
    const SpeechRec =
      win.SpeechRecognition || win.webkitSpeechRecognition || null;

    if (!SpeechRec) {
      // Open the Voice & Accessibility modal so the user can use 1-click commands or voice input
      setIsAccessibilityModalOpen(true);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-AR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalCaptured = '';

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript('Escuchando comando de voz...');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const textPiece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalCaptured += textPiece;
          } else {
            interim += textPiece;
          }
        }
        setLiveTranscript((finalCaptured || interim).trim());
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (finalCaptured.trim()) {
          runTranscriptCommand(finalCaptured.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setIsAccessibilityModalOpen(true);
    }
  };

  const handleReadDailyRoute = () => {
    if (isSpeaking) {
      onStopSpeaking();
      return;
    }
    const script = buildDailyRouteSpeechText(
      activeDate,
      baseCity,
      activeDateJobs,
      activeDayWeather
    );
    onSpeakText(script);
  };

  const handleManualCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCommandInput.trim()) return;
    runTranscriptCommand(manualCommandInput);
    setManualCommandInput('');
  };

  return (
    <>
      {/* Screen-reader live region for voice & accessibility announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {lastVoiceStatus || liveTranscript}
      </div>

      {/* Sleek Single-Line Glassmorphic Command & Accessibility Strip */}
      <section
        aria-label="Comandos de voz, lectura hablada y accesibilidad"
        className="surface-glass-bar rounded-2xl px-2.5 sm:px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2"
      >
        <div className="flex items-center gap-1.5">
          {/* Primary Microphone Voice Command Button */}
          <button
            type="button"
            onClick={toggleMicrophoneListening}
            aria-pressed={isListening}
            title="Hablar comando por micrófono (Atajo: Alt+V). Ej: 'Agregar cliente', 'Completar corte', 'Cambiar fecha a mañana'"
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              isListening
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-200'
                : 'bg-[#071912] text-white hover:bg-emerald-950'
            }`}
          >
            {isListening ? (
              <MicOff className="w-3.5 h-3.5 text-red-200 shrink-0" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>
              {isListening ? 'Escuchando...' : 'Comando de Voz'}
            </span>
          </button>

          {/* Read Daily Route Aloud Button (Text-to-Speech) */}
          <button
            type="button"
            onClick={handleReadDailyRoute}
            aria-pressed={isSpeaking}
            title="Escuchar lectura en voz alta de la hoja de ruta del día (Atajo: Alt+L)"
            className={`min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isSpeaking
                ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                : 'bg-emerald-50/90 text-emerald-950 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isSpeaking ? (
              <>
                <Square className="w-3 h-3 fill-current shrink-0" />
                <span>Detener</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Escuchar Ruta</span>
              </>
            )}
          </button>

          {(liveTranscript || lastVoiceStatus) && (
            <div
              data-testid="voice-command-feedback"
              className="text-xs font-medium text-emerald-950 bg-emerald-50/95 border border-emerald-200 px-2.5 py-1 rounded-xl max-w-xs sm:max-w-md truncate"
            >
              <span className="font-mono font-bold text-emerald-700 mr-1">
                Voz:
              </span>
              <span>{lastVoiceStatus || `«${liveTranscript}»`}</span>
            </div>
          )}
        </div>

        {/* Right side: Quick Outdoor High-Contrast + Font Scale + Voice/Accessibility Drawer */}
        <div className="flex items-center gap-1.5">
          {/* 1-Tap Outdoor Sunlight Contrast Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdatePreferences({
                ...preferences,
                highContrastOutdoor: !preferences.highContrastOutdoor,
              })
            }
            aria-pressed={preferences.highContrastOutdoor}
            title="Activar o desactivar modo alto contraste para sol directo"
            className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              preferences.highContrastOutdoor
                ? 'bg-amber-400 text-slate-950 border-amber-500 font-bold'
                : 'bg-white/90 text-slate-700 border-slate-200/90 hover:bg-slate-100'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {preferences.highContrastOutdoor ? 'Modo Sol: Activo' : 'Modo Sol'}
            </span>
          </button>

          {/* Quick Font Scale Cycle Button */}
          <button
            type="button"
            onClick={() => {
              const nextScale =
                preferences.fontScale === 'normal'
                  ? 'large'
                  : preferences.fontScale === 'large'
                  ? 'xlarge'
                  : 'normal';
              onUpdatePreferences({
                ...preferences,
                fontScale: nextScale,
              });
            }}
            title="Cambiar tamaño de letra para mejor lectura bajo el sol"
            className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              preferences.fontScale !== 'normal'
                ? 'bg-emerald-900 text-white border-emerald-900'
                : 'bg-white/90 text-slate-700 border-slate-200/90 hover:bg-slate-100'
            }`}
          >
            <Type className="w-3.5 h-3.5 shrink-0" />
            <span>
              Letra:{' '}
              {preferences.fontScale === 'normal'
                ? 'Normal'
                : preferences.fontScale === 'large'
                ? 'Grande'
                : 'Extra'}
            </span>
          </button>

          {/* Open Full Voice & Accessibility Modal */}
          <button
            type="button"
            onClick={() => setIsAccessibilityModalOpen(true)}
            className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="hidden sm:inline">Ayuda de Voz y Ajustes</span>
            <span className="sm:hidden">Ajustes</span>
          </button>
        </div>
      </section>

      {/* Modal Completo de Comandos de Voz, Lectura Hablada y Accesibilidad */}
      {isAccessibilityModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-accessibility-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  WEB SPEECH API · ACCESIBILIDAD Y MANOS LIBRES
                </span>
                <h2
                  id="voice-accessibility-modal-title"
                  className="font-display text-lg font-bold text-slate-900 mt-0.5"
                >
                  Comandos de Voz, Lectura y Modo Exterior
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Usa la voz para operar la app con las manos ocupadas o ajusta el tamaño de letra y contraste para ver mejor al sol.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessibilityModalOpen(false)}
                aria-label="Cerrar panel de voz y accesibilidad"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Microphone & Simulated Voice Command Input */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-700" />
                  <span>1. Ejecutar Comando por Voz (Español)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {speechSupported
                    ? 'Micrófono Web Speech API Activo'
                    : 'Modo Simulador / Teclado Activo'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={toggleMicrophoneListening}
                  className={`min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isListening
                      ? 'bg-red-600 text-white'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {isListening
                      ? 'Escuchando micrófono...'
                      : 'Hablar por Micrófono'}
                  </span>
                </button>

                <form
                  onSubmit={handleManualCommandSubmit}
                  className="flex-1 flex gap-2"
                >
                  <input
                    type="text"
                    aria-label="Escribir o dictar comando de voz"
                    placeholder="Ej: agregar cliente, completar corte, cambiar fecha a mañana..."
                    value={manualCommandInput}
                    onChange={(e) => setManualCommandInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 whitespace-nowrap"
                  >
                    Ejecutar
                  </button>
                </form>
              </div>

              {/* Quick Voice Command Chips */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-600">
                  Toca cualquier comando para probarlo o ejecutarlo ahora mismo:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_VOICE_EXAMPLES.map((cmd) => (
                    <button
                      key={cmd.phrase}
                      type="button"
                      onClick={() => {
                        runTranscriptCommand(cmd.phrase);
                        setIsAccessibilityModalOpen(false);
                      }}
                      className="min-h-[34px] px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-xl transition-colors"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Lectura de Voz (Text-to-Speech) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>2. Lectura en Voz Alta (Síntesis de Voz)</span>
                </div>
                <button
                  type="button"
                  onClick={handleReadDailyRoute}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    isSpeaking
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Detener Voz</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Leer Resumen del Día</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 cursor-pointer">
                  <span>Confirmar acciones por voz</span>
                  <input
                    type="checkbox"
                    checked={preferences.autoSpeakConfirmations}
                    onChange={(e) =>
                      onUpdatePreferences({
                        ...preferences,
                        autoSpeakConfirmations: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-emerald-600"
                  />
                </label>

                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs">
                  <span className="font-medium text-slate-800">
                    Velocidad de voz:
                  </span>
                  <select
                    aria-label="Velocidad de lectura de voz"
                    value={String(preferences.speechRate)}
                    onChange={(e) =>
                      onUpdatePreferences({
                        ...preferences,
                        speechRate: Number(e.target.value),
                      })
                    }
                    className="px-2 py-1 border border-slate-300 rounded-lg bg-slate-50 font-mono text-xs"
                  >
                    <option value="0.85">Pausada (0.85x)</option>
                    <option value="1">Normal (1.0x)</option>
                    <option value="1.15">Rápida (1.15x)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Accesibilidad Visual (Tamaño de Letra y Alto Contraste al Sol) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span>3. Legibilidad y Accesibilidad Visual (Modo Papá / Sol Directo)</span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1.5">
                  Tamaño del texto en toda la aplicación:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'normal', label: 'Normal (100%)' },
                      { id: 'large', label: 'Grande (110%)' },
                      { id: 'xlarge', label: 'Extra Grande (120%)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          fontScale: opt.id,
                        })
                      }
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        preferences.fontScale === opt.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Modo Alto Contraste para Sol Directo
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Bordes reforzados y textos más oscuros para ver mejor el celular en la calle
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.highContrastOutdoor}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      highContrastOutdoor: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Atajos: Alt+V (Comando Voz) · Alt+L (Leer Ruta)
              </span>
              <button
                type="button"
                onClick={() => setIsAccessibilityModalOpen(false)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Listo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
