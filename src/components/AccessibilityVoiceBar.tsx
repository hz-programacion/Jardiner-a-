import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Mic,
  MicOff,
  Navigation,
  Plus,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ScheduledJob } from '../types/lawn';
import {
  AccessibilitySettings,
  buildDailySummarySpeech,
  buildJobCardSpeech,
  formatSpokenPesos,
  formatSpokenTime,
  speakTextInSpanish,
  startSpanishVoiceDictation,
  stopSpeaking,
} from '../utils/accessibilityAndVoice';
import { buildGoogleMapsNavUrl } from '../utils/lawnLogic';

interface SpeakButtonProps {
  text: string;
  label?: string;
  rate?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onSpoken?: (text: string) => void;
}

export function SpeakButton({
  text,
  label = 'Escuchar',
  rate = 0.95,
  className = '',
  size = 'sm',
  onSpoken,
}: SpeakButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleToggleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    onSpoken?.(text);
    speakTextInSpanish(
      text,
      rate,
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  const sizeClasses =
    size === 'lg'
      ? 'min-h-[52px] px-4 py-3 text-sm sm:text-base font-extrabold rounded-2xl gap-2'
      : size === 'md'
      ? 'min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl gap-1.5'
      : 'min-h-[36px] px-2.5 py-1.5 text-xs font-bold rounded-xl gap-1.5';

  return (
    <button
      type="button"
      onClick={handleToggleSpeak}
      title={isPlaying ? 'Detener lectura en voz alta' : `Escuchar en voz alta: ${label}`}
      aria-label={isPlaying ? 'Detener voz' : label}
      className={`inline-flex items-center justify-center border transition-all whitespace-nowrap shrink-0 ${sizeClasses} ${
        isPlaying
          ? 'bg-amber-400 text-slate-950 border-amber-600 shadow-sm ring-2 ring-amber-400/40'
          : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
      } ${className}`}
    >
      {isPlaying ? (
        <VolumeX className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      ) : (
        <Volume2 className={size === 'lg' ? 'w-5 h-5 text-amber-800' : 'w-4 h-4 text-amber-800'} />
      )}
      <span>{isPlaying ? 'Detener Voz' : label}</span>
    </button>
  );
}

export interface QuickVoiceOption {
  emoji: string;
  label: string;
  value: string;
}

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  fieldLabel?: string;
  quickOptions?: QuickVoiceOption[];
  rate?: number;
  className?: string;
}

export function VoiceDictationButton({
  onTranscript,
  fieldLabel = 'este campo',
  quickOptions = [],
  rate = 0.95,
  className = '',
}: VoiceDictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleTriggerVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening) {
      setIsListening(false);
      return;
    }

    setStatusMessage(`Hablá ahora para completar ${fieldLabel}...`);
    setIsListening(true);

    const stopFn = startSpanishVoiceDictation({
      onResult: (transcript) => {
        setIsListening(false);
        setStatusMessage(null);
        onTranscript(transcript);
        speakTextInSpanish(`Anotado: ${transcript}`, rate);
      },
      onError: () => {
        setIsListening(false);
        setStatusMessage(null);
        if (quickOptions.length > 0) {
          setShowQuickPicker(true);
          speakTextInSpanish(
            `Tocá una de las opciones con dibujo para completar ${fieldLabel} sin escribir.`,
            rate
          );
        } else {
          speakTextInSpanish(
            `El micrófono no está disponible en esta ventana. Podés elegir una opción en pantalla.`,
            rate
          );
        }
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (!stopFn && quickOptions.length > 0) {
      setShowQuickPicker(true);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleTriggerVoice}
        title={`Hablar por micrófono para no escribir (${fieldLabel})`}
        aria-label={`Dictar por voz ${fieldLabel}`}
        className={`min-h-[38px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
          isListening
            ? 'bg-red-600 text-white border-red-700 animate-pulse'
            : 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
        } ${className}`}
      >
        {isListening ? (
          <>
            <MicOff className="w-3.5 h-3.5" />
            <span>Escuchando...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-emerald-700" />
            <span>Hablar</span>
          </>
        )}
      </button>

      {quickOptions.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const nextOpen = !showQuickPicker;
            setShowQuickPicker(nextOpen);
            if (nextOpen) {
              speakTextInSpanish(
                `Elegí una opción con dibujo para ${fieldLabel}`,
                rate
              );
            }
          }}
          title={`Elegir con dibujos sin escribir (${fieldLabel})`}
          className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
        >
          <span>👆 Sin escribir</span>
        </button>
      )}

      {statusMessage && isListening && (
        <span className="text-[11px] font-bold text-red-700 ml-1">
          {statusMessage}
        </span>
      )}

      {showQuickPicker && quickOptions.length > 0 && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <span className="text-xs font-extrabold text-slate-900">
              👆 Tocá un dibujo (sin escribir):
            </span>
            <button
              type="button"
              onClick={() => setShowQuickPicker(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 px-1.5 py-0.5"
            >
              Cerrar ✕
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  onTranscript(opt.value);
                  speakTextInSpanish(opt.label, rate);
                  setShowQuickPicker(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 text-xs font-bold text-slate-900 transition-colors"
              >
                <span className="text-lg shrink-0">{opt.emoji}</span>
                <span className="leading-snug">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface AccessibilityControlStripProps {
  settings: AccessibilitySettings;
  todayJobs: ScheduledJob[];
  cityLabel: string;
  lastSpokenBanner: string | null;
  onUpdateSettings: (next: AccessibilitySettings) => void;
  onSpokenBanner: (text: string) => void;
}

export function AccessibilityControlStrip({
  settings,
  todayJobs,
  cityLabel,
  lastSpokenBanner,
  onUpdateSettings,
  onSpokenBanner,
}: AccessibilityControlStripProps) {
  const dailySummaryText = buildDailySummarySpeech(todayJobs, cityLabel);

  const cycleFontScale = () => {
    const order: AccessibilitySettings['fontScale'][] = [
      'normal',
      'large',
      'xlarge',
    ];
    const nextIdx = (order.indexOf(settings.fontScale) + 1) % order.length;
    const nextScale = order[nextIdx];
    onUpdateSettings({ ...settings, fontScale: nextScale });
    const labelMap = {
      normal: 'Tamaño de letra normal',
      large: 'Letra grande activada',
      xlarge: 'Letra extra grande activada para ver mejor',
    };
    speakTextInSpanish(labelMap[nextScale], settings.speechRate);
    onSpokenBanner(labelMap[nextScale]);
  };

  const toggleEasyMode = () => {
    const nextEasy = !settings.easyMode;
    onUpdateSettings({
      ...settings,
      easyMode: nextEasy,
      autoReadOnTap: nextEasy ? true : settings.autoReadOnTap,
      fontScale:
        nextEasy && settings.fontScale === 'normal'
          ? 'large'
          : settings.fontScale,
    });
    const speech = nextEasy
      ? 'Modo Fácil activado. Pantalla guiada paso a paso con dibujos grandes y ayuda por voz.'
      : 'Modo Fácil desactivado. Volviste a la pantalla completa.';
    speakTextInSpanish(speech, settings.speechRate);
    onSpokenBanner(speech);
  };

  const toggleSunContrast = () => {
    const nextSun = !settings.highContrastSun;
    onUpdateSettings({ ...settings, highContrastSun: nextSun });
    const speech = nextSun
      ? 'Modo Sol Fuerte activado. Bordes y letras más oscuras para ver bajo el sol.'
      : 'Modo Sol Fuerte desactivado.';
    speakTextInSpanish(speech, settings.speechRate);
    onSpokenBanner(speech);
  };

  const toggleAutoRead = () => {
    const nextAuto = !settings.autoReadOnTap;
    onUpdateSettings({ ...settings, autoReadOnTap: nextAuto });
    const speech = nextAuto
      ? 'Lectura automática activada. La aplicación te hablará al tocar cada sección.'
      : 'Lectura automática desactivada.';
    speakTextInSpanish(speech, settings.speechRate);
    onSpokenBanner(speech);
  };

  return (
    <section
      aria-label="Barra de accesibilidad, lectura por voz y modo fácil sin saber leer ni escribir"
      className={`rounded-2xl p-3 sm:p-4 transition-all border-2 ${
        settings.easyMode || settings.highContrastSun
          ? 'bg-amber-50/95 border-slate-900 shadow-md'
          : 'surface-card border-emerald-200/90'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0B2219] text-amber-300 flex items-center justify-center text-xl shrink-0">
            🔊
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-extrabold text-slate-900">
                Ayuda por Voz y Modo Fácil (Sin necesidad de leer ni escribir)
              </h2>
              {settings.easyMode && (
                <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-700 text-white rounded-md">
                  MODO FÁCIL ACTIVO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Tocá <strong>&ldquo;Escuchar Día&rdquo;</strong> para que el teléfono te hable, o activá el <strong>&ldquo;Modo Fácil con Dibujos&rdquo;</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Escuchar Resumen del Día */}
          <SpeakButton
            text={dailySummaryText}
            label="🔊 Escuchar mi Día"
            rate={settings.speechRate}
            size="md"
            onSpoken={(txt) => onSpokenBanner(txt)}
          />

          {/* 2. Modo Fácil Paso a Paso con Dibujos */}
          <button
            type="button"
            onClick={toggleEasyMode}
            aria-pressed={settings.easyMode}
            className={`min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 transition-all whitespace-nowrap ${
              settings.easyMode
                ? 'bg-[#0B2219] text-white border-[#0B2219] shadow-sm'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className="text-base">👷</span>
            <span>
              {settings.easyMode
                ? 'Salir de Modo Fácil'
                : 'Modo Fácil (Con Dibujos)'}
            </span>
          </button>

          {/* 3. Tamaño de Letra */}
          <button
            type="button"
            onClick={cycleFontScale}
            title="Cambiar tamaño de letra para ver sin anteojos"
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all whitespace-nowrap ${
              settings.fontScale !== 'normal'
                ? 'bg-emerald-800 text-white border-emerald-900'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span>🔍 Letra:</span>
            <span className="uppercase">
              {settings.fontScale === 'normal'
                ? 'Normal'
                : settings.fontScale === 'large'
                ? 'Grande'
                : 'Extra Grande'}
            </span>
          </button>

          {/* 4. Alto Contraste para Sol Fuerte */}
          <button
            type="button"
            onClick={toggleSunContrast}
            aria-pressed={settings.highContrastSun}
            title="Activar alto contraste para ver mejor bajo el sol del mediodía"
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all whitespace-nowrap ${
              settings.highContrastSun
                ? 'bg-slate-950 text-amber-300 border-slate-950'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Sol Fuerte</span>
          </button>

          {/* 5. Hablar al tocar */}
          <button
            type="button"
            onClick={toggleAutoRead}
            aria-pressed={settings.autoReadOnTap}
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all whitespace-nowrap ${
              settings.autoReadOnTap
                ? 'bg-emerald-100 text-emerald-950 border-emerald-500'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span>👆 Hablar al tocar</span>
          </button>
        </div>
      </div>

      {lastSpokenBanner && (
        <div className="mt-3 pt-2.5 border-t border-amber-300/80 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🗣️</span>
            <span className="truncate">{lastSpokenBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onSpokenBanner('');
            }}
            className="px-2.5 py-1 text-xs font-extrabold bg-slate-900 text-white rounded-lg shrink-0"
          >
            Silenciar
          </button>
        </div>
      )}
    </section>
  );
}

interface EasyStepByStepRouteViewProps {
  jobs: ScheduledJob[];
  selectedJobId: string | null;
  speechRate: number;
  onSelectJob: (jobId: string) => void;
  onCompleteJob: (job: ScheduledJob) => void;
  onStartJob: (jobId: string) => void;
  onOpenNewClient: () => void;
  onSpokenBanner: (text: string) => void;
}

export function EasyStepByStepRouteView({
  jobs,
  selectedJobId,
  speechRate,
  onSelectJob,
  onCompleteJob,
  onStartJob,
  onOpenNewClient,
  onSpokenBanner,
}: EasyStepByStepRouteViewProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-lg">
        <div className="text-5xl">🚜</div>
        <h3 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900">
          Hoy no hay cortes anotados
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <SpeakButton
            text="Hoy no tenés ningún corte anotado. Tocá el botón verde con el signo más para anotar un cliente nuevo."
            label="🔊 Escuchar"
            size="lg"
            rate={speechRate}
            onSpoken={onSpokenBanner}
          />
          <button
            type="button"
            onClick={onOpenNewClient}
            className="min-h-[56px] inline-flex items-center gap-2 px-6 py-3 text-base font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-2xl shadow-md"
          >
            <Plus className="w-6 h-6" />
            <span>➕ Anotar Corte Nuevo</span>
          </button>
        </div>
      </div>
    );
  }

  // Pick selected job, or first pending job, or first job
  const currentIndex = Math.max(
    0,
    jobs.findIndex((j) => j.id === selectedJobId) !== -1
      ? jobs.findIndex((j) => j.id === selectedJobId)
      : Math.max(
          0,
          jobs.findIndex((j) => j.status !== 'Completado')
        )
  );
  const currentJob = jobs[currentIndex] || jobs[0];
  const isCompleted = currentJob.status === 'Completado';
  const isInProgress = currentJob.status === 'En Curso';
  const navUrl = buildGoogleMapsNavUrl(currentJob.coordinates);
  const cleanPhone = currentJob.phone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hola ${currentJob.clientName}, te aviso que estoy yendo para ${currentJob.address} a cortar el pasto.`
  )}`;

  const propertyEmoji =
    currentJob.propertyType === 'Quinta'
      ? '🌳'
      : currentJob.propertyType === 'Terreno'
      ? '🌾'
      : '🏠';

  const fullSpeech = buildJobCardSpeech(currentJob, currentIndex + 1);

  const handleGoPrev = () => {
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : jobs.length - 1;
    const target = jobs[prevIdx];
    onSelectJob(target.id);
    const speech = buildJobCardSpeech(target, prevIdx + 1);
    speakTextInSpanish(speech, speechRate);
    onSpokenBanner(speech);
  };

  const handleGoNext = () => {
    const nextIdx = (currentIndex + 1) % jobs.length;
    const target = jobs[nextIdx];
    onSelectJob(target.id);
    const speech = buildJobCardSpeech(target, nextIdx + 1);
    speakTextInSpanish(speech, speechRate);
    onSpokenBanner(speech);
  };

  return (
    <div className="bg-white border-4 border-slate-900 rounded-3xl p-4 sm:p-6 space-y-5 shadow-lg">
      {/* Barra superior de paradas con dibujos (1 toque por parada) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚜</span>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
              MODO FÁCIL PASO A PASO · PARADA {currentIndex + 1} DE {jobs.length}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900">
              Tocá los botones grandes con dibujos o el parlante amarillo
            </div>
          </div>
        </div>

        {/* Selector visual de paradas con dibujos */}
        <div className="flex flex-wrap items-center gap-1.5">
          {jobs.map((j, idx) => {
            const active = idx === currentIndex;
            const done = j.status === 'Completado';
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => {
                  onSelectJob(j.id);
                  const sp = buildJobCardSpeech(j, idx + 1);
                  speakTextInSpanish(sp, speechRate);
                  onSpokenBanner(sp);
                }}
                className={`min-h-[44px] min-w-[48px] px-3 py-1.5 rounded-xl font-mono text-sm font-extrabold border-2 flex items-center gap-1 transition-all ${
                  active
                    ? 'bg-[#0B2219] text-white border-[#0B2219] scale-105 shadow-sm'
                    : done
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-500'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                <span>{done ? '✅' : '🌿'}</span>
                <span>{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ficha Gigante Visual de la Parada Actual */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border-2 space-y-4 ${
          isCompleted
            ? 'bg-emerald-50/90 border-emerald-600'
            : isInProgress
            ? 'bg-amber-50/90 border-amber-500'
            : 'bg-slate-50 border-slate-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center text-3xl shrink-0 shadow-xs">
              {isCompleted ? '✅' : propertyEmoji}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
                <span>⏰ {currentJob.scheduledTime} hs</span>
                <span>·</span>
                <span>
                  {isCompleted
                    ? 'YA TERMINADO'
                    : isInProgress
                    ? 'CORTANDO AHORA'
                    : 'POR HACER'}
                </span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1 leading-tight">
                {currentJob.clientName}
              </h3>
              <p className="text-base sm:text-lg font-bold text-slate-800 mt-1 flex items-center gap-2">
                <span>📍</span>
                <span>
                  {currentJob.address} ({currentJob.neighborhood})
                </span>
              </p>
            </div>
          </div>

          {/* Tarjeta visual del Precio a Cobrar */}
          <div
            onClick={() => {
              const sp = `Precio a cobrar en lo de ${currentJob.clientName}: ${formatSpokenPesos(
                currentJob.price
              )}, horario ${formatSpokenTime(currentJob.scheduledTime)}.`;
              speakTextInSpanish(sp, speechRate);
              onSpokenBanner(sp);
            }}
            className="bg-white border-2 border-emerald-700 rounded-2xl p-3.5 text-left sm:text-right cursor-pointer hover:bg-emerald-50 transition-colors shrink-0"
          >
            <div className="text-xs font-extrabold uppercase text-slate-600">
              💵 PLATA A COBRAR (TOCÁ PARA ESCUCHAR)
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-800 tabular-nums mt-0.5">
              ${currentJob.price.toLocaleString('es-AR')}
            </div>
            <div className="text-xs font-bold text-slate-700 mt-0.5">
              {formatSpokenPesos(currentJob.price)}
            </div>
          </div>
        </div>

        {/* Tareas con Pictogramas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
          <div className="bg-white border border-slate-300 rounded-xl p-3">
            <div className="text-xs font-extrabold uppercase text-slate-500 mb-1">
              🌿 QUÉ HAY QUE HACER EN ESTE LOTE:
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900">
              {currentJob.tasks.join(' + ')}
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-3">
            <div className="text-xs font-extrabold uppercase text-slate-500 mb-1">
              🔑 CÓMO ENTRAR / PORTÓN / PERRO:
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-900">
              {currentJob.accessNotes || 'Tocar timbre o avisar por WhatsApp'}
            </div>
          </div>
        </div>
      </div>

      {/* 4 BOTONES GIGANTES CON DIBUJOS Y COLORES CLAROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Botón 1: Escuchar Todo en Voz Alta */}
        <SpeakButton
          text={fullSpeech}
          label="🔊 1. ESCUCHAR QUÉ HACER"
          rate={speechRate}
          size="lg"
          className="w-full justify-center py-4 text-base border-2"
          onSpoken={onSpokenBanner}
        />

        {/* Botón 2: Abrir Mapa GPS */}
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            speakTextInSpanish(
              `Abriendo el mapa GPS para ir a ${currentJob.address}`,
              speechRate
            )
          }
          className="min-h-[56px] w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-base font-extrabold text-white bg-blue-700 hover:bg-blue-800 border-2 border-blue-900 shadow-xs transition-all"
        >
          <Navigation className="w-5 h-5 shrink-0" />
          <span>🧭 2. IR CON MAPA GPS</span>
        </a>

        {/* Botón 3: Avisar por WhatsApp */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            speakTextInSpanish(
              `Abriendo WhatsApp para avisarle a ${currentJob.clientName} que estás yendo`,
              speechRate
            )
          }
          className="min-h-[56px] w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-base font-extrabold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-600 transition-all"
        >
          <MessageCircle className="w-5 h-5 text-emerald-800 shrink-0" />
          <span>💬 3. AVISAR POR WHATSAPP</span>
        </a>

        {/* Botón 4: Terminé / Cobrar */}
        {!isCompleted ? (
          <button
            type="button"
            onClick={() => {
              speakTextInSpanish(
                `Terminar trabajo de ${currentJob.clientName}. Monto a cobrar: ${formatSpokenPesos(
                  currentJob.price
                )}.`,
                speechRate
              );
              onCompleteJob(currentJob);
            }}
            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-base font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 border-2 border-emerald-950 shadow-md transition-all"
          >
            <Check className="w-6 h-6 stroke-[3] shrink-0" />
            <span>✅ 4. TERMINÉ / COBRAR</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStartJob(currentJob.id)}
            className="min-h-[56px] w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl text-base font-extrabold text-emerald-900 bg-emerald-50 border-2 border-emerald-500"
          >
            <span>✅ TRABAJO YA COBRADO</span>
          </button>
        )}
      </div>

      {/* Navegación Anterior / Siguiente Parada */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t-2 border-slate-200">
        <button
          type="button"
          onClick={handleGoPrev}
          className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>⬅️ Parada Anterior</span>
        </button>

        <button
          type="button"
          onClick={handleGoNext}
          className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-[#0B2219] hover:bg-emerald-950"
        >
          <span>Siguiente Parada ➡️</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
