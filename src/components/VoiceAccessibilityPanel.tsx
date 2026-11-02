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
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {lastVoiceStatus || liveTranscript}
      </div>

      {/* Minimalist Inline Utility Bar — Whisper-quiet borderless strip */}
      <div
        aria-label="Comandos de voz, lectura hablada y accesibilidad"
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMicrophoneListening}
            aria-pressed={isListening}
            title="Hablar comando por micrófono (Atajo: Alt+V)"
            className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isListening
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80'
            }`}
          >
            {isListening ? (
              <MicOff className="w-3.5 h-3.5 text-red-200 shrink-0" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span>{isListening ? 'Escuchando...' : 'Comando de Voz'}</span>
          </button>

          <button
            type="button"
            onClick={handleReadDailyRoute}
            aria-pressed={isSpeaking}
            title="Escuchar lectura en voz alta de la hoja de ruta del día (Atajo: Alt+L)"
            className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isSpeaking
                ? 'bg-amber-600 text-white'
                : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80'
            }`}
          >
            {isSpeaking ? (
              <>
                <Square className="w-3 h-3 fill-current shrink-0" />
                <span>Detener</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span>Escuchar Ruta</span>
              </>
            )}
          </button>

          {(liveTranscript || lastVoiceStatus) && (
            <div
              data-testid="voice-command-feedback"
              className="text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg max-w-xs sm:max-w-md truncate"
            >
              <span className="font-mono font-semibold text-emerald-700 mr-1">
                Voz:
              </span>
              <span>{lastVoiceStatus || `«${liveTranscript}»`}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
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
            className={`hidden sm:inline-flex min-h-[32px] items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              preferences.highContrastOutdoor
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {preferences.highContrastOutdoor ? 'Modo Sol: Activo' : 'Modo Sol'}
            </span>
          </button>

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
            title="Cambiar tamaño de letra"
            className={`hidden md:inline-flex min-h-[32px] items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              preferences.fontScale !== 'normal'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
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

          <button
            type="button"
            onClick={() => setIsAccessibilityModalOpen(true)}
            className="min-h-[32px] inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Ayuda de Voz y Ajustes</span>
            <span className="sm:hidden">Ajustes</span>
          </button>
        </div>
      </div>

      {isAccessibilityModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-accessibility-modal-title"
          className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-3.5">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  WEB SPEECH API · ACCESIBILIDAD Y MANOS LIBRES
                </span>
                <h2
                  id="voice-accessibility-modal-title"
                  className="font-display text-lg font-bold text-zinc-900 mt-0.5"
                >
                  Comandos de Voz, Lectura y Modo Exterior
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Opera la aplicación mediante comandos hablados o ajusta la legibilidad para luz solar directa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessibilityModalOpen(false)}
                aria-label="Cerrar panel de voz y accesibilidad"
                className="p-2 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-700" />
                  <span>1. Ejecutar Comando por Voz (Español)</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {speechSupported
                    ? 'Micrófono Web Speech API Activo'
                    : 'Modo Simulador / Teclado Activo'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={toggleMicrophoneListening}
                  className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isListening
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
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
                    className="flex-1 px-3 py-2 text-xs border border-zinc-300 rounded-xl bg-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 whitespace-nowrap"
                  >
                    Ejecutar
                  </button>
                </form>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-zinc-600">
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
                      className="min-h-[32px] px-3 py-1 text-xs font-medium text-zinc-800 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg transition-colors"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>2. Lectura en Voz Alta (Síntesis de Voz)</span>
                </div>
                <button
                  type="button"
                  onClick={handleReadDailyRoute}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    isSpeaking
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
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
                <label className="flex items-center justify-between p-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 cursor-pointer">
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
                    className="rounded border-zinc-300 text-emerald-600"
                  />
                </label>

                <div className="flex items-center justify-between p-2.5 bg-white border border-zinc-200 rounded-xl text-xs">
                  <span className="font-medium text-zinc-800">
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
                    className="px-2 py-1 border border-zinc-300 rounded-lg bg-zinc-50 font-mono text-xs"
                  >
                    <option value="0.85">Pausada (0.85x)</option>
                    <option value="1">Normal (1.0x)</option>
                    <option value="1.15">Rápida (1.15x)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span>3. Legibilidad y Accesibilidad Visual</span>
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-600 mb-1.5">
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
                      className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        preferences.fontScale === opt.id
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-xl cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-zinc-900">
                      Modo Alto Contraste para Sol Directo
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Bordes definidos y textos más intensos para lectura en exteriores
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
                  className="w-4 h-4 rounded border-zinc-300 text-emerald-600"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-500 font-mono">
                Atajos: Alt+V (Comando Voz) · Alt+L (Leer Ruta)
              </span>
              <button
                type="button"
                onClick={() => setIsAccessibilityModalOpen(false)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800"
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
