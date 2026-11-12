import React, { useState, useMemo } from 'react';
import {
  Plus,
  Check,
  DollarSign,
  Volume2,
  VolumeX,
  X,
  Smile,
  Clock,
  Sparkles,
  Camera,
  RotateCcw,
  User,
  MapPin,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { ScheduledJob, ClientProperty, PaymentMethod } from '../types/lawn';
import { speakTextAloud, stopSpeakingAloud } from '../utils/voiceAccessibility';

export interface EasyAccessDashboardProps {
  todayJobs: ScheduledJob[];
  activeDate: string;
  properties: ClientProperty[];
  onCompleteJob: (
    jobId: string,
    paidNow: boolean,
    paymentMethod: PaymentMethod,
    finalPrice: number,
    updateClientBasePrice: boolean,
    photoUrl?: string,
    actualDurationMinutes?: number
  ) => void;
  onQuickAddJob: (
    clientName: string,
    approxPrice: number,
    address?: string
  ) => void;
  onExitEasyMode: () => void;
}

export function EasyAccessDashboard({
  todayJobs,
  activeDate,
  properties,
  onCompleteJob,
  onQuickAddJob,
  onExitEasyMode,
}: EasyAccessDashboardProps) {
  // Modal states
  const [activeModal, setActiveModal] = useState<
    'none' | 'new-job' | 'complete-job' | 'day-total'
  >('none');
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(true);

  // New Job Quick Form State (Icon-driven & Simple)
  const [newJobClientName, setNewJobClientName] = useState('');
  const [newJobPrice, setNewJobPrice] = useState('15000');
  const [newJobAddress, setNewJobAddress] = useState('');
  const [selectedPresetClient, setSelectedPresetClient] =
    useState<ClientProperty | null>(null);

  // Complete Job Form State
  const [paidNow, setPaidNow] = useState(true);
  const [paymentType, setPaymentType] = useState<PaymentMethod>('Efectivo');
  const [customPrice, setCustomPrice] = useState<string>('');

  // Voice helper that respects the voice toggle
  const speak = (text: string) => {
    if (!isVoiceActive) return;
    speakTextAloud(text);
  };

  // Calculations for day
  const { completedJobs, pendingJobs, totalCobrado, totalEstimado } =
    useMemo(() => {
      const completed = todayJobs.filter((j) => j.status === 'Completado');
      const pending = todayJobs.filter((j) => j.status !== 'Completado');
      const cobrado = completed.reduce((acc, j) => acc + (j.price || 0), 0);
      const estimado = todayJobs.reduce((acc, j) => acc + (j.price || 0), 0);
      return {
        completedJobs: completed,
        pendingJobs: pending,
        totalCobrado: cobrado,
        totalEstimado: estimado,
      };
    }, [todayJobs]);

  // Open complete modal
  const handleOpenComplete = (job: ScheduledJob) => {
    setSelectedJob(job);
    setCustomPrice(String(job.price || 15000));
    setPaidNow(true);
    setPaymentType('Efectivo');
    setActiveModal('complete-job');
    speak(
      `Terminar trabajo de ${job.clientName}. El precio es ${job.price} pesos. ¿Te pagaron en mano?`
    );
  };

  // Confirm complete
  const handleConfirmComplete = () => {
    if (!selectedJob) return;
    const priceNum = Number(customPrice) || selectedJob.price || 15000;
    onCompleteJob(
      selectedJob.id,
      paidNow,
      paymentType,
      priceNum,
      false,
      undefined,
      selectedJob.estimatedMinutes || 45
    );
    setActiveModal('none');
    setSelectedJob(null);
    speak(
      `¡Excelente! Trabajo de ${selectedJob.clientName} guardado como terminado.`
    );
  };

  // Submit quick new job
  const handleCreateQuickJob = (e: React.FormEvent) => {
    e.preventDefault();
    const name = selectedPresetClient
      ? selectedPresetClient.clientName
      : newJobClientName.trim() || 'Nuevo Cliente';
    const address = selectedPresetClient
      ? selectedPresetClient.address
      : newJobAddress.trim() || 'Domicilio';
    const price = Number(newJobPrice) || 15000;

    onQuickAddJob(name, price, address);
    setNewJobClientName('');
    setNewJobAddress('');
    setSelectedPresetClient(null);
    setActiveModal('none');
    speak(`Nuevo trabajo de ${name} agregado para hoy.`);
  };

  return (
    <div
      data-testid="easy-access-dashboard"
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans"
    >
      {/* ============================================================== */}
      {/* TOP BAR: HIGH CONTRAST, LOGO & VOICE BUTTON                   */}
      {/* ============================================================== */}
      <header className="px-4 py-4 sm:px-6 bg-slate-900 border-b-4 border-amber-400 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">
            🌱
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>TRABAJOS DE HOY</span>
            </h1>
            <p className="text-amber-300 font-bold text-xs sm:text-sm">
              MODO FÁCIL CON BOTONES GRANDES
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Voice helper button */}
          <button
            type="button"
            data-testid="easy-voice-toggle-btn"
            onClick={() => {
              if (isVoiceActive) {
                stopSpeakingAloud();
                setIsVoiceActive(false);
              } else {
                setIsVoiceActive(true);
                speakTextAloud('Voz de ayuda activada.');
              }
            }}
            className={`p-3 rounded-2xl font-black flex items-center gap-2 text-sm transition-transform active:scale-95 ${
              isVoiceActive
                ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Activar o silenciar la voz de ayuda"
          >
            {isVoiceActive ? (
              <Volume2 className="w-6 h-6 stroke-[3]" />
            ) : (
              <VolumeX className="w-6 h-6 stroke-[2]" />
            )}
            <span className="hidden sm:inline">
              {isVoiceActive ? 'VOZ ACTIVA' : 'SIN VOZ'}
            </span>
          </button>

          {/* Exit button */}
          <button
            type="button"
            data-testid="exit-easy-mode-btn"
            onClick={onExitEasyMode}
            className="px-3 py-2 sm:px-4 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-slate-600 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
          >
            <X className="w-5 h-5 text-rose-400 stroke-[3]" />
            <span>SALIR</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 3 GIANT HERO ACTIONS (NEW JOB, FINISH JOB, DAY TOTAL)           */}
      {/* ============================================================== */}
      <div className="max-w-5xl mx-auto w-full px-4 py-6 sm:py-8 flex-1 flex flex-col justify-center gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. BOTÓN VERDE GIGANTE: NUEVO TRABAJO */}
          <button
            type="button"
            data-testid="easy-btn-new-job"
            onClick={() => {
              setActiveModal('new-job');
              speak('Tocaste sumar nuevo trabajo.');
            }}
            className="group relative min-h-[140px] sm:min-h-[180px] p-6 rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex flex-col items-center justify-center gap-3 shadow-[0_12px_0_#065f46] hover:shadow-[0_6px_0_#065f46] active:translate-y-1.5 active:shadow-[0_2px_0_#065f46] transition-all cursor-pointer text-center ring-4 ring-emerald-300"
          >
            <div className="w-16 h-16 rounded-full bg-slate-950 text-emerald-400 flex items-center justify-center shadow-md">
              <Plus className="w-10 h-10 stroke-[4]" />
            </div>
            <span className="text-xl sm:text-2xl font-black uppercase tracking-wide">
              + NUEVO TRABAJO
            </span>
            <span className="text-xs sm:text-sm font-bold bg-slate-950/20 px-3 py-1 rounded-full">
              SUMAR CORTE HOY
            </span>
          </button>

          {/* 2. BOTÓN AZUL GIGANTE: MARCAR TERMINADO */}
          <button
            type="button"
            data-testid="easy-btn-finish-job"
            onClick={() => {
              if (pendingJobs.length > 0) {
                handleOpenComplete(pendingJobs[0]);
              } else if (todayJobs.length > 0) {
                speak('¡Excelente! Todos los trabajos de hoy ya están listos.');
              } else {
                speak('No hay trabajos en la lista. Sumá uno con el botón verde.');
              }
            }}
            className="group relative min-h-[140px] sm:min-h-[180px] p-6 rounded-3xl bg-blue-500 hover:bg-blue-400 text-white font-black flex flex-col items-center justify-center gap-3 shadow-[0_12px_0_#1e3a8a] hover:shadow-[0_6px_0_#1e3a8a] active:translate-y-1.5 active:shadow-[0_2px_0_#1e3a8a] transition-all cursor-pointer text-center ring-4 ring-blue-300"
          >
            <div className="w-16 h-16 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-md">
              <Check className="w-10 h-10 stroke-[4]" />
            </div>
            <span className="text-xl sm:text-2xl font-black uppercase tracking-wide">
              MARCAR TERMINADO
            </span>
            <span className="text-xs sm:text-sm font-bold bg-slate-950/30 px-3 py-1 rounded-full text-blue-100">
              {pendingJobs.length} PENDIENTES
            </span>
          </button>

          {/* 3. BOTÓN AMARILLO GIGANTE: VER TOTAL DEL DÍA */}
          <button
            type="button"
            data-testid="easy-btn-day-total"
            onClick={() => {
              setActiveModal('day-total');
              speak(
                `Total del día. Cobraste ${totalCobrado} pesos en mano de ${completedJobs.length} trabajos terminados.`
              );
            }}
            className="group relative min-h-[140px] sm:min-h-[180px] p-6 rounded-3xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black flex flex-col items-center justify-center gap-3 shadow-[0_12px_0_#78350f] hover:shadow-[0_6px_0_#78350f] active:translate-y-1.5 active:shadow-[0_2px_0_#78350f] transition-all cursor-pointer text-center ring-4 ring-amber-200"
          >
            <div className="w-16 h-16 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shadow-md">
              <DollarSign className="w-10 h-10 stroke-[4]" />
            </div>
            <span className="text-xl sm:text-2xl font-black uppercase tracking-wide">
              TOTAL DEL DÍA
            </span>
            <span className="text-xs sm:text-sm font-bold bg-slate-950/20 px-3 py-1 rounded-full">
              ${totalCobrado.toLocaleString('es-AR')} EN MANO
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* LISTA DE TRABAJOS DE HOY: TARJETAS GRANDES CON ICONOS          */}
        {/* ============================================================== */}
        <div className="mt-4 bg-slate-900 border-4 border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
            <h2 className="text-lg sm:text-xl font-black uppercase text-amber-400 flex items-center gap-2">
              <span>📋 LISTA DE HOY ({todayJobs.length})</span>
            </h2>
            <span className="text-sm font-bold text-slate-400">
              {completedJobs.length} LISTOS · {pendingJobs.length} POR HACER
            </span>
          </div>

          {todayJobs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-5xl">🚜</div>
              <p className="text-xl font-black text-white">
                NO HAY TRABAJOS ANOTADOS HOY
              </p>
              <p className="text-slate-400 text-sm max-w-md mx-auto font-medium">
                Tocá el botón verde grande arriba para anotar el primer corte del
                día.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayJobs.map((job, idx) => {
                const isDone = job.status === 'Completado';
                return (
                  <div
                    key={job.id}
                    data-testid={`easy-job-row-${idx}`}
                    className={`p-4 sm:p-5 rounded-2xl border-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      isDone
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100'
                        : 'bg-slate-800 border-amber-400 text-white'
                    }`}
                  >
                    {/* Left: Stop Number & Big Name */}
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 ${
                          isDone
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 truncate">
                          <span>{job.clientName}</span>
                          {isDone && (
                            <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-lg">
                              LISTO
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-300 font-bold flex items-center gap-2 mt-0.5">
                          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">
                            {job.address || job.neighborhood || 'Domicilio'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Big Price & Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-bold block">
                          VALOR
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                          ${job.price.toLocaleString('es-AR')}
                        </span>
                      </div>

                      {/* Action: Terminar */}
                      {!isDone ? (
                        <button
                          type="button"
                          onClick={() => handleOpenComplete(job)}
                          className="px-5 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-black text-base flex items-center gap-2 shadow-lg transition-transform cursor-pointer"
                        >
                          <Check className="w-6 h-6 stroke-[4]" />
                          <span>TERMINÉ</span>
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-xl bg-emerald-900/80 border border-emerald-500 text-emerald-300 font-bold text-sm flex items-center gap-1.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>COBRADO</span>
                        </div>
                      )}

                      {/* Botón escuchar este cliente */}
                      <button
                        type="button"
                        onClick={() =>
                          speak(
                            `Trabajo de ${job.clientName}. Dirección: ${job.address}. Precio: ${job.price} pesos. Estado: ${
                              isDone ? 'Terminado' : 'Pendiente'
                            }.`
                          )
                        }
                        className="p-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-amber-300"
                        title="Escuchar información"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: NUEVO TRABAJO (ULTRA SIMPLE)                          */}
      {/* ============================================================== */}
      {activeModal === 'new-job' && (
        <div
          data-testid="easy-modal-new-job"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border-4 border-emerald-400 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-2xl">
                  +
                </div>
                <h2 className="text-2xl font-black">ANOTAR TRABAJO</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-2xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-8 h-8 stroke-[3]" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickJob} className="space-y-5">
              {/* Opción rápida: Elegir un cliente guardado */}
              {properties.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-bold text-amber-300 uppercase block">
                    1. ELEGIR CLIENTE FRECUENTE (OPCIONAL):
                  </span>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-950 rounded-2xl border-2 border-slate-800">
                    {properties.slice(0, 8).map((prop) => {
                      const isSelected = selectedPresetClient?.id === prop.id;
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            setSelectedPresetClient(prop);
                            setNewJobClientName(prop.clientName);
                            setNewJobPrice(String(prop.basePrice));
                            setNewJobAddress(prop.address);
                            speak(
                              `Elegiste a ${prop.clientName}. Precio ${prop.basePrice} pesos.`
                            );
                          }}
                          className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-white'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div className="truncate text-sm font-black">
                            {prop.clientName}
                          </div>
                          <div className="text-[11px] opacity-80 truncate">
                            ${prop.basePrice.toLocaleString('es-AR')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nombre si no es de la lista */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 uppercase block">
                  O ESCRIBÍ EL NOMBRE:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Don Roberto"
                  value={newJobClientName}
                  onChange={(e) => {
                    setNewJobClientName(e.target.value);
                    if (selectedPresetClient) setSelectedPresetClient(null);
                  }}
                  className="w-full px-4 py-3 text-lg font-bold bg-slate-950 border-4 border-slate-700 rounded-2xl text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Dirección simple */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 uppercase block">
                  CALLE O LUGAR:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mitre 450"
                  value={newJobAddress}
                  onChange={(e) => setNewJobAddress(e.target.value)}
                  className="w-full px-4 py-3 text-base font-bold bg-slate-950 border-4 border-slate-700 rounded-2xl text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Botones de precios fijos gigantes */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-amber-300 uppercase block">
                  ¿CUÁNTO SE COBRA? (ELEGÍ UN VALOR):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['10000', '15000', '20000', '25000', '30000', '40000'].map(
                    (val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setNewJobPrice(val);
                          speak(`${val} pesos`);
                        }}
                        className={`py-3 rounded-2xl font-black text-lg transition-transform active:scale-95 ${
                          newJobPrice === val
                            ? 'bg-amber-400 text-slate-950 ring-4 ring-white'
                            : 'bg-slate-800 text-white hover:bg-slate-700 border-2 border-slate-700'
                        }`}
                      >
                        ${Number(val).toLocaleString('es-AR')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Botón Guardar Gigante */}
              <button
                type="submit"
                className="w-full min-h-[64px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xl flex items-center justify-center gap-2 shadow-[0_6px_0_#065f46] transition-all cursor-pointer"
              >
                <Check className="w-8 h-8 stroke-[4]" />
                <span>GUARDAR TRABAJO</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: MARCAR TERMINADO & COBRAR                            */}
      {/* ============================================================== */}
      {activeModal === 'complete-job' && selectedJob && (
        <div
          data-testid="easy-modal-complete-job"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border-4 border-blue-400 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-black text-2xl">
                  ✓
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black">
                    TRABAJO LISTO
                  </h2>
                  <p className="text-blue-300 font-bold text-sm">
                    {selectedJob.clientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-2xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-8 h-8 stroke-[3]" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Monto a cobrar */}
              <div className="p-4 bg-slate-950 rounded-2xl border-2 border-slate-800 text-center space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  VALOR DE ESTE CORTE
                </span>
                <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono">
                  ${(Number(customPrice) || selectedJob.price).toLocaleString('es-AR')}
                </div>
              </div>

              {/* ¿Te pagaron ahora? */}
              <div className="space-y-3">
                <span className="text-sm font-bold text-amber-300 uppercase block">
                  ¿TE PAGARON EN EL MOMENTO?
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaidNow(true);
                      speak('Cobrado ahora.');
                    }}
                    className={`py-4 px-3 rounded-2xl font-black text-base flex flex-col items-center gap-2 transition-all ${
                      paidNow
                        ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-3xl">💵</span>
                    <span>SÍ, ME PAGÓ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaidNow(false);
                      speak('Anotado como pendiente para cobrar después.');
                    }}
                    className={`py-4 px-3 rounded-2xl font-black text-base flex flex-col items-center gap-2 transition-all ${
                      !paidNow
                        ? 'bg-rose-500 text-white ring-4 ring-rose-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-3xl">⏳</span>
                    <span>PAGA DESPUÉS</span>
                  </button>
                </div>
              </div>

              {/* Forma de pago si cobró ahora */}
              {paidNow && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase block">
                    ¿CÓMO TE PAGÓ?
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentType('Efectivo')}
                      className={`p-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${
                        paymentType === 'Efectivo'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>💵 EFECTIVO</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('Transferencia')}
                      className={`p-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${
                        paymentType === 'Transferencia'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>📱 TRANSFERENCIA</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Botón confirmar final */}
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="w-full min-h-[64px] rounded-2xl bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-black text-xl flex items-center justify-center gap-2 shadow-[0_6px_0_#1e3a8a] transition-all cursor-pointer"
              >
                <Check className="w-8 h-8 stroke-[4]" />
                <span>CONFIRMAR Y FINALIZAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: VER TOTAL DEL DÍA (MI PLATA EN MANO)                  */}
      {/* ============================================================== */}
      {activeModal === 'day-total' && (
        <div
          data-testid="easy-modal-day-total"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 text-white shadow-2xl text-center">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl">
                  💰
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-left">
                  TOTAL DEL DÍA
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-2xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-8 h-8 stroke-[3]" />
              </button>
            </div>

            {/* Número Gigante de Cobro */}
            <div className="p-6 bg-slate-950 rounded-3xl border-4 border-amber-400 space-y-2">
              <span className="text-sm font-bold text-amber-300 uppercase block">
                PLATA COBRADA HOY EN MANO:
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white font-mono">
                ${totalCobrado.toLocaleString('es-AR')}
              </div>
              <p className="text-emerald-400 font-bold text-sm">
                ✓ {completedJobs.length} cortes terminados y cobrados
              </p>
            </div>

            {/* Faltante por cobrar */}
            {pendingJobs.length > 0 && (
              <div className="p-4 bg-slate-800/80 rounded-2xl border-2 border-slate-700 flex items-center justify-between text-left">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block">
                    FALTAN POR TERMINAR:
                  </span>
                  <span className="text-base font-black text-white">
                    {pendingJobs.length} trabajos pendientes
                  </span>
                </div>
                <div className="text-right font-mono font-black text-xl text-amber-400">
                  +$
                  {pendingJobs
                    .reduce((a, b) => a + (b.price || 0), 0)
                    .toLocaleString('es-AR')}
                </div>
              </div>
            )}

            {/* Botón escuchar en voz alta */}
            <button
              type="button"
              onClick={() =>
                speak(
                  `Hoy cobraste ${totalCobrado} pesos en total. Ya terminaste ${completedJobs.length} trabajos. Quedan ${pendingJobs.length} por hacer.`
                )
              }
              className="w-full min-h-[56px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg flex items-center justify-center gap-2 shadow-lg"
            >
              <Volume2 className="w-6 h-6 stroke-[3]" />
              <span>ESCUCHAR RESUMEN EN VOZ ALTA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
