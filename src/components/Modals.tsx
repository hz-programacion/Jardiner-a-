import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  Clock,
  CreditCard,
  Crosshair,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
  TrendingUp,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  BaseLocationConfig,
  BusinessProfileConfig,
  ClientProperty,
  CutFrequency,
  GrassCondition,
  InvoiceRecord,
  JobPhotoItem,
  JobPhotoStage,
  LatLng,
  OfflineSyncAction,
  PaymentMethod,
  PaymentProfileConfig,
  PaymentStatus,
  PropertyType,
  ScheduledJob,
} from '../types/lawn';
import {
  calculateFieldJobSurcharges,
  calculateSuggestedPrice,
  computeNextCutDate,
  extractInvoicePhotoItems,
  FIELD_SURCHARGE_PRESETS,
  getClientBeforeAfterGallery,
  getClientCutTimeHistory,
  getClientPriceHistory,
  getTodayIsoLocal,
  resolveCityCoordinates,
} from '../utils/lawnLogic';
import {
  CITY_PRESETS,
  NEIGHBORHOOD_COORDINATES,
  SAMPLE_GARDEN_PHOTOS,
} from '../data/seedData';
import {
  CityAutocomplete,
  StreetAddressAutocomplete,
} from './StreetAddressAutocomplete';
import {
  downloadReceiptAsPdf,
  downloadReceiptAsPng,
} from '../utils/receiptPrinter';
import { generateCryptographicReceiptSeal } from '../utils/backendEngine';
import { BeforeAfterSlider } from './BeforeAfterSlider';

const TASK_QUICK_PRESETS = [
  { id: 'corte', shortTitle: 'Corte Césped', taskText: 'Corte de césped' },
  { id: 'bordeado', shortTitle: 'Bordeado', taskText: 'Bordeado perimetral' },
  { id: 'embolsado', shortTitle: 'Embolsado', taskText: 'Embolsado de pasto' },
  { id: 'desmalezado', shortTitle: 'Desmalezado', taskText: 'Desmalezado pesado' },
  { id: 'cerco', shortTitle: 'Poda Cerco', taskText: 'Recorte de cerco vivo' },
  { id: 'vereda', shortTitle: 'Barrido Vereda', taskText: 'Soplado y barrido de vereda' },
];

const SAMPLE_COMPLETED_LAWN_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#dcfce7"/>
          <stop offset="100%" stop-color="#f0fdf4"/>
        </linearGradient>
        <pattern id="stripes" width="40" height="320" patternUnits="userSpaceOnUse">
          <rect width="20" height="320" fill="#15803d" fill-opacity="0.88"/>
          <rect x="20" width="20" height="320" fill="#16a34a" fill-opacity="0.88"/>
        </pattern>
      </defs>
      <rect width="640" height="145" fill="url(#sky)"/>
      <rect y="140" width="640" height="180" fill="url(#stripes)"/>
      <rect x="0" y="256" width="640" height="64" fill="#020617" fill-opacity="0.82"/>
      <text x="24" y="284" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="bold">Corte en franjas, bordeado perimetral y vereda despejada</text>
      <text x="24" y="305" fill="#6ee7b7" font-family="monospace" font-size="12" font-weight="bold">PastoPro · Trabajo finalizado y verificado en campo</text>
    </svg>`
  );

interface CompleteJobModalProps {
  job: ScheduledJob | null;
  invoices: InvoiceRecord[];
  paymentProfile?: PaymentProfileConfig;
  isOnline?: boolean;
  initialDurationMinutes?: number | null;
  onClose: () => void;
  onConfirmComplete: (
    jobId: string,
    paidNow: boolean,
    paymentMethod: PaymentMethod,
    finalPrice: number,
    updateClientBasePrice: boolean,
    photoUrl?: string,
    actualDurationMinutes?: number,
    customNextVisitDate?: string | null,
    beforePhotos?: string[],
    afterPhotos?: string[]
  ) => void;
}

export function CompleteJobModal({
  job,
  invoices,
  paymentProfile,
  isOnline = true,
  initialDurationMinutes,
  onClose,
  onConfirmComplete,
}: CompleteJobModalProps) {
  const [paidNow, setPaidNow] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Transferencia');
  const [finalPrice, setFinalPrice] = useState<string>(
    job ? String(job.price) : '0'
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(
    job ? String(job.actualDurationMinutes || job.estimatedMinutes || 45) : '45'
  );
  const [updateClientBasePrice, setUpdateClientBasePrice] =
    useState<boolean>(true);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [scheduleNextVisit, setScheduleNextVisit] = useState<boolean>(true);
  const [customNextDate, setCustomNextDate] = useState<string>('');
  const [selectedSurcharges, setSelectedSurcharges] = useState<string[]>([]);

  useEffect(() => {
    if (job) {
      setFinalPrice(String(job.price));
      setPaidNow(true);
      setPaymentMethod('Transferencia');
      setUpdateClientBasePrice(true);
      setBeforePhotos(job.beforePhotos ? [...job.beforePhotos] : []);
      setAfterPhotos(
        job.afterPhotos && job.afterPhotos.length > 0
          ? [...job.afterPhotos]
          : job.photoUrl
            ? [job.photoUrl]
            : []
      );
      setSelectedSurcharges([]);
      const isOneTime = job.frequency === 'Única vez';
      setScheduleNextVisit(!isOneTime);
      const computedNext = computeNextCutDate(
        job.scheduledDate,
        isOneTime ? 'Quincenal' : job.frequency
      );
      setCustomNextDate(
        computedNext === 'Sin reprogramar' ? '' : computedNext
      );
      const defaultDur =
        initialDurationMinutes && initialDurationMinutes > 0
          ? initialDurationMinutes
          : job.actualDurationMinutes && job.actualDurationMinutes > 0
            ? job.actualDurationMinutes
            : job.estimatedMinutes || 45;
      setDurationMinutes(String(defaultDur));
    }
  }, [job, initialDurationMinutes]);

  if (!job) return null;

  const clientHistory = getClientPriceHistory(
    job.propertyId,
    job.clientName,
    invoices
  );
  const cutTimeHistory = getClientCutTimeHistory(
    job.propertyId,
    job.clientName,
    invoices,
    [job],
    job.estimatedMinutes,
    job.areaSqm
  );
  const referenceLastAmount = clientHistory.lastAmount || job.price;
  const parsedDuration = Math.max(
    5,
    Math.round(Number(durationMinutes) || job.estimatedMinutes || 45)
  );
  const parsedPricePreview = Math.max(1000, Number(finalPrice) || job.price);
  const hourlyYieldArs = Math.round((parsedPricePreview / parsedDuration) * 60);
  const speedSqmPerHour = Math.round(((job.areaSqm || 200) / parsedDuration) * 60);

  const surchargeBreakdown = calculateFieldJobSurcharges(
    parsedPricePreview,
    job.areaSqm || 250,
    parsedDuration,
    []
  );

  const applyQuickAdjustment = (multiplier: number) => {
    setSelectedSurcharges([]);
    const rounded = Math.round((referenceLastAmount * multiplier) / 500) * 500;
    setFinalPrice(String(rounded));
  };

  const handleToggleSurcharge = (presetId: string) => {
    const nextIds = selectedSurcharges.includes(presetId)
      ? selectedSurcharges.filter((id) => id !== presetId)
      : [...selectedSurcharges, presetId];
    setSelectedSurcharges(nextIds);
    const calc = calculateFieldJobSurcharges(
      job.price,
      job.areaSqm || 250,
      parsedDuration,
      nextIds
    );
    setFinalPrice(String(calc.finalPrice));
  };

  const handleMultiPhotosUpload = (
    stage: JobPhotoStage,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const dataUrl = reader.result;
          if (stage === 'antes') {
            setBeforePhotos((prev) => [...prev, dataUrl]);
          } else {
            setAfterPhotos((prev) => [...prev, dataUrl]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddSampleBefore = () => {
    const samples =
      job.propertyType === 'Terreno'
        ? [SAMPLE_GARDEN_PHOTOS.terrenoAntes1, SAMPLE_GARDEN_PHOTOS.quintaAntes2]
        : job.propertyType === 'Quinta'
          ? [SAMPLE_GARDEN_PHOTOS.quintaAntes1, SAMPLE_GARDEN_PHOTOS.quintaAntes2]
          : [SAMPLE_GARDEN_PHOTOS.casaAntes1, SAMPLE_GARDEN_PHOTOS.quintaAntes2];
    setBeforePhotos((prev) => {
      const nextSample = samples[prev.length % samples.length];
      return [...prev, nextSample];
    });
  };

  const handleAddSampleAfter = () => {
    const samples =
      job.propertyType === 'Terreno'
        ? [SAMPLE_GARDEN_PHOTOS.terrenoDespues1, SAMPLE_COMPLETED_LAWN_SVG]
        : job.propertyType === 'Quinta'
          ? [SAMPLE_GARDEN_PHOTOS.quintaDespues1, SAMPLE_GARDEN_PHOTOS.quintaDespues2]
          : [SAMPLE_GARDEN_PHOTOS.casaDespues1, SAMPLE_COMPLETED_LAWN_SVG];
    setAfterPhotos((prev) => {
      const nextSample = samples[prev.length % samples.length];
      return [...prev, nextSample];
    });
  };

  const handleAddSampleComparisonPair = () => {
    handleAddSampleBefore();
    handleAddSampleAfter();
  };

  const handleRemoveStagePhoto = (stage: JobPhotoStage, index: number) => {
    if (stage === 'antes') {
      setBeforePhotos((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setAfterPhotos((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Math.max(1000, Number(finalPrice) || job.price);
    const resolvedNextDate =
      scheduleNextVisit && customNextDate.trim()
        ? customNextDate.trim()
        : null;
    const primaryPhotoUrl = afterPhotos[0] || beforePhotos[0] || undefined;
    onConfirmComplete(
      job.id,
      paidNow,
      paymentMethod,
      parsedPrice,
      updateClientBasePrice,
      primaryPhotoUrl,
      parsedDuration,
      resolvedNextDate,
      beforePhotos,
      afterPhotos
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-job-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-xl my-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div>
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              CIERRE DE ORDEN DE TRABAJO · {job.propertyType.toUpperCase()} ({job.areaSqm} m²)
            </div>
            <h2
              id="complete-job-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              ✅ Completar Corte, Fotos Antes/Después y Recibo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {job.clientName} · {job.address} ({job.neighborhood})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!isOnline && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Modo Sin Señal (Offline):</strong> El corte, las fotos y el
                recibo se guardarán localmente y se sincronizarán al recuperar señal.
              </span>
            </div>
          )}

          {/* SECCIÓN 1: LIQUIDACIÓN E HISTORIAL */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-700" />
                <span>1. Liquidación e Historial ({clientHistory.totalCutsCount} cortes)</span>
              </span>
              {clientHistory.lastAmount && (
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                  Último: ${clientHistory.lastAmount.toLocaleString('es-AR')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label
                  htmlFor="final-price-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Monto a Cobrar Hoy ($)
                </label>
                <input
                  id="final-price-input"
                  type="number"
                  min={1000}
                  step={500}
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
              </div>
              <div className="sm:col-span-6">
                <div className="text-[11px] text-slate-600 mb-1">
                  Ajuste rápido vs. último cobro:
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'Igual', mult: 1 },
                    { label: '+10%', mult: 1.1 },
                    { label: '+15%', mult: 1.15 },
                    { label: '+20%', mult: 1.2 },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => applyQuickAdjustment(b.mult)}
                      className="py-2 px-1.5 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-mono cursor-pointer"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Adicionales Rápidos en Terreno */}
            <div
              data-testid="field-surcharge-chips"
              className="p-2.5 rounded-xl bg-white/90 border border-emerald-200/80 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
                <span>⚡ Adicionales de Campo (Sumar al cobro):</span>
                {selectedSurcharges.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSurcharges([]);
                      setFinalPrice(String(job.price));
                    }}
                    className="text-[10px] font-mono text-emerald-700 underline cursor-pointer"
                  >
                    Restaurar base
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FIELD_SURCHARGE_PRESETS.map((preset) => {
                  const isActive = selectedSurcharges.includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`surcharge-chip-${preset.id}`}
                      onClick={() => handleToggleSurcharge(preset.id)}
                      className={`min-h-[34px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border text-left transition-all cursor-pointer flex items-center justify-between gap-1 ${
                        isActive
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{preset.shortTag}</span>
                      <span>{isActive ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-slate-600">
                  Insumos est. (Nafta 2T + Tanza): -${surchargeBreakdown.estimatedInsumosCost.toLocaleString('es-AR')}
                </span>
                <strong className="text-emerald-700">
                  Ganancia limpia: ${surchargeBreakdown.netPocketProfit.toLocaleString('es-AR')}
                </strong>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={updateClientBasePrice}
                onChange={(e) => setUpdateClientBasePrice(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              <span>Actualizar tarifa habitual del cliente con este monto</span>
            </label>
          </div>

          {/* SECCIÓN 2: CONTROL DE TIEMPO REAL DE CORTE */}
          <div
            data-testid="complete-job-time-control"
            className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label
                htmlFor="actual-duration-minutes-input"
                className="text-xs font-extrabold uppercase tracking-wider text-teal-950 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>2. Tiempo Real de Corte (minutos)</span>
              </label>
              <span className="text-[11px] font-mono text-teal-800">
                Prom. lote: {cutTimeHistory.averageMinutes} min · Rinde: ${hourlyYieldArs.toLocaleString('es-AR')}/h ({speedSqmPerHour} m²/h)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                id="actual-duration-minutes-input"
                data-testid="actual-duration-minutes-input"
                type="number"
                min={5}
                max={600}
                step={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-24 px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-sm font-bold font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <div className="flex flex-wrap gap-1 flex-1">
                {[
                  { label: '-5m', val: Math.max(5, parsedDuration - 5) },
                  { label: `Est. (${job.estimatedMinutes}m)`, val: job.estimatedMinutes || 45 },
                  { label: '+5m', val: parsedDuration + 5 },
                  { label: '+15m', val: parsedDuration + 15 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => setDurationMinutes(String(btn.val))}
                    className="px-2.5 py-1.5 text-[11px] font-mono font-semibold bg-white border border-teal-200 rounded-lg hover:bg-teal-100 text-teal-950 cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: EVIDENCIA FOTOGRÁFICA MÚLTIPLE "ANTES" Y "DESPUÉS" */}
          <div
            data-testid="complete-job-before-after-section"
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  <span>3. Registro Fotográfico: Antes y Después del Jardín</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Añadí múltiples fotos del estado inicial y final. Se guardan en la Ficha del Cliente y en la Galería de Facturación.
                </p>
              </div>
              <button
                type="button"
                data-testid="add-sample-pair-btn"
                onClick={handleAddSampleComparisonPair}
                className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                + Par Antes / Después
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Columna ANTES */}
              <div
                data-testid="before-photos-panel"
                className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    <span>Fotos del &ldquo;Antes&rdquo;</span>
                  </span>
                  <span
                    data-testid="before-photos-count"
                    className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-[11px] font-bold"
                  >
                    {beforePhotos.length} {beforePhotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <label className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100/60 cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Sacar / Subir Antes</span>
                    <input
                      data-testid="before-photos-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotosUpload('antes', e)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="add-sample-before-photo-btn"
                    onClick={handleAddSampleBefore}
                    className="min-h-[34px] px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 bg-amber-100/70 border border-amber-300 rounded-lg hover:bg-amber-200/70 cursor-pointer"
                  >
                    + Muestra
                  </button>
                </div>

                {beforePhotos.length > 0 ? (
                  <div
                    data-testid="before-photos-grid"
                    className="grid grid-cols-2 gap-2 pt-1"
                  >
                    {beforePhotos.map((url, idx) => (
                      <div
                        key={`before-${idx}`}
                        className="relative group rounded-lg overflow-hidden border border-amber-300 bg-slate-900 aspect-video"
                      >
                        <img
                          src={url}
                          alt={`Antes ${idx + 1} - ${job.clientName}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-amber-600/90 text-white font-mono text-[9px] font-bold uppercase">
                          Antes #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagePhoto('antes', idx)}
                          aria-label={`Quitar foto antes ${idx + 1}`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white hover:bg-red-600 flex items-center justify-center text-xs cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 px-2 text-center rounded-lg border border-dashed border-amber-300/80 text-[11px] text-amber-900/70">
                    Sin fotos del estado inicial. Podés añadir varias tomas del lote antes de cortar.
                  </div>
                )}
              </div>

              {/* Columna DESPUÉS */}
              <div
                data-testid="after-photos-panel"
                className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/90 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Fotos del &ldquo;Después&rdquo;</span>
                  </span>
                  <span
                    data-testid="after-photos-count"
                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold"
                  >
                    {afterPhotos.length} {afterPhotos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <label className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-emerald-950 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100/60 cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Sacar / Subir Después</span>
                    <input
                      data-testid="after-photos-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultiPhotosUpload('despues', e)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="add-sample-after-photo-btn"
                    onClick={handleAddSampleAfter}
                    className="min-h-[34px] px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-100/70 border border-emerald-300 rounded-lg hover:bg-emerald-200/70 cursor-pointer"
                  >
                    + Muestra
                  </button>
                </div>

                {afterPhotos.length > 0 ? (
                  <div
                    data-testid="after-photos-grid"
                    className="grid grid-cols-2 gap-2 pt-1"
                  >
                    {afterPhotos.map((url, idx) => (
                      <div
                        key={`after-${idx}`}
                        className="relative group rounded-lg overflow-hidden border border-emerald-300 bg-slate-900 aspect-video"
                      >
                        <img
                          src={url}
                          alt={`Después ${idx + 1} - ${job.clientName}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white font-mono text-[9px] font-bold uppercase">
                          Después #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagePhoto('despues', idx)}
                          aria-label={`Quitar foto después ${idx + 1}`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white hover:bg-red-600 flex items-center justify-center text-xs cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 px-2 text-center rounded-lg border border-dashed border-emerald-300/80 text-[11px] text-emerald-900/70">
                    Sin fotos del resultado final. Subí una o más fotos del corte y bordeado terminado.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: COBRO Y PRÓXIMA VISITA */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
              4. Estado del Cobro y Próxima Visita
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaidNow(true)}
                className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-extrabold border transition-colors whitespace-nowrap cursor-pointer ${
                  paidNow
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Cobrado Ahora
              </button>
              <button
                type="button"
                onClick={() => setPaidNow(false)}
                className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-extrabold border transition-colors whitespace-nowrap cursor-pointer ${
                  !paidNow
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Pendiente / Cuenta Cte.
              </button>
            </div>

            {paidNow && (
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Medio de pago recibido ({paymentProfile?.alias || 'mi.alias.cobro'}):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'Efectivo', label: 'Efectivo' },
                      { id: 'Transferencia', label: 'Transferencia' },
                      { id: 'MercadoPago', label: 'MercadoPago' },
                    ] as const
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`min-h-[38px] py-1.5 px-2 rounded-xl text-xs font-bold border flex items-center justify-center transition-all cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-[#0B2219] text-white border-[#0B2219]'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleNextVisit(true)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    scheduleNextVisit
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  ✓ Agendar Próxima ({job.frequency})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleNextVisit(false)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    !scheduleNextVisit
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Servicio Puntual
                </button>
              </div>

              {scheduleNextVisit && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label
                    htmlFor="custom-next-date-input"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Fecha próxima visita:
                  </label>
                  <input
                    id="custom-next-date-input"
                    type="date"
                    value={customNextDate}
                    onChange={(e) => setCustomNextDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required={scheduleNextVisit}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="confirm-complete-job-btn"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar y Emitir Recibo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ClientHistoryModalProps {
  client: ClientProperty | null;
  invoices: InvoiceRecord[];
  jobs?: ScheduledJob[];
  onClose: () => void;
  onEditClient: (client: ClientProperty) => void;
  onSelectInvoiceReceipt: (invoice: InvoiceRecord) => void;
  onAddClientPhotos?: (
    propertyId: string,
    stage: JobPhotoStage,
    photoUrls: string[]
  ) => void;
}

export function ClientHistoryModal({
  client,
  invoices,
  jobs = [],
  onClose,
  onEditClient,
  onSelectInvoiceReceipt,
  onAddClientPhotos,
}: ClientHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'galeria'>('resumen');
  const [lightboxPhoto, setLightboxPhoto] = useState<JobPhotoItem | null>(null);

  useEffect(() => {
    setActiveTab('resumen');
    setLightboxPhoto(null);
  }, [client?.id]);

  if (!client) return null;

  const history = getClientPriceHistory(
    client.id,
    client.clientName,
    invoices
  );
  const cutTimeSummary = getClientCutTimeHistory(
    client.id,
    client.clientName,
    invoices,
    jobs,
    client.estimatedMinutes,
    client.areaSqm
  );
  const clientGallery = getClientBeforeAfterGallery(client, invoices);

  const durationByInvoiceId = new Map<string, number>();
  for (const r of cutTimeSummary.records) {
    if (r.invoiceId) {
      durationByInvoiceId.set(r.invoiceId, r.durationMinutes);
    }
  }

  const handleUploadDirectClientPhotos = (
    stage: JobPhotoStage,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !onAddClientPhotos) return;
    const files: File[] = Array.from(fileList);
    const loaded: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          loaded.push(reader.result);
          if (loaded.length === files.length) {
            onAddClientPhotos(client.id, stage, loaded);
          }
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-history-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-xl my-4 break-words">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Ficha Técnica del Cliente · Historial, Tiempos y Galería Antes/Después
            </div>
            <h2
              id="client-history-title"
              className="text-lg font-bold text-slate-900 mt-0.5 break-words"
            >
              {client.clientName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 break-words">
              {client.address} · {client.neighborhood} ({client.propertyType} ·{' '}
              {client.areaSqm} m²)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Secciones de la Ficha del Cliente */}
        <div
          data-testid="client-ficha-tabs"
          className="mt-3 grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200"
        >
          <button
            type="button"
            data-testid="client-ficha-summary-tab"
            onClick={() => setActiveTab('resumen')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'resumen'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-700" />
            <span>1. Precios, Tiempos y Visitas</span>
          </button>
          <button
            type="button"
            data-testid="client-ficha-gallery-tab"
            onClick={() => setActiveTab('galeria')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'galeria'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              2. Galería Antes y Después ({clientGallery.allPhotos.length})
            </span>
          </button>
        </div>

        <div className="py-4 space-y-4">
          {activeTab === 'resumen' && (
            <>
              {/* Resumen de Precios y Cobros */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">
                    Tarifa Actual
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5 break-all">
                    ${client.basePrice.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[11px] text-slate-500">{client.frequency}</div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl min-w-0">
                  <div className="text-[11px] text-emerald-900 font-medium">
                    Último Cobro
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-emerald-800 tabular-nums mt-0.5 break-all">
                    {history.lastAmount
                      ? `$${history.lastAmount.toLocaleString('es-AR')}`
                      : 'Sin reg.'}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-mono">
                    {history.lastDate || client.lastCutDate}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">
                    Cobro Anterior
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5 break-all">
                    {history.previousAmount
                      ? `$${history.previousAmount.toLocaleString('es-AR')}`
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {history.variationPercent !== null
                      ? `Variación: ${
                          history.variationPercent >= 0 ? '+' : ''
                        }${history.variationPercent}%`
                      : history.previousDate || '1ra vez'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">
                    Total Histórico
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5 break-all">
                    ${history.totalBilled.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {history.totalCutsCount} cortes hechos
                  </div>
                </div>
              </div>

              {/* Panel de Control de Tiempo e Historial de Cuánto Tarda en Cortar el Pasto */}
              <div
                data-testid="client-cut-time-history-panel"
                className="p-3.5 sm:p-4 rounded-2xl bg-[#0B1D16] text-white space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      Control de Tiempo e Historial de Corte
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-300">
                    Estimado base: {client.estimatedMinutes} min · {client.areaSqm} m²
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-300 block">
                      Promedio por Corte
                    </span>
                    <span
                      data-testid="client-avg-cut-minutes"
                      className="text-base font-mono font-extrabold text-teal-300 tabular-nums"
                    >
                      {cutTimeSummary.averageMinutes} min
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {cutTimeSummary.varianceFromEstimateMinutes === 0
                        ? 'Exacto al estimado'
                        : cutTimeSummary.varianceFromEstimateMinutes > 0
                          ? `+${cutTimeSummary.varianceFromEstimateMinutes}m vs est.`
                          : `${cutTimeSummary.varianceFromEstimateMinutes}m vs est.`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-300 block">
                      Último Tiempo Real
                    </span>
                    <span className="text-base font-mono font-extrabold text-white tabular-nums">
                      {cutTimeSummary.lastDurationMinutes
                        ? `${cutTimeSummary.lastDurationMinutes} min`
                        : `${client.estimatedMinutes} min`}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {cutTimeSummary.totalTimedCuts} cortes medidos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-300 block">
                      Rango (Rápido / Lento)
                    </span>
                    <span className="text-sm font-mono font-bold text-white tabular-nums block mt-0.5">
                      {cutTimeSummary.fastestMinutes
                        ? `${cutTimeSummary.fastestMinutes}m / ${cutTimeSummary.slowestMinutes}m`
                        : `${client.estimatedMinutes}m`}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {cutTimeSummary.avgSqmPerHour} m²/hora
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-300 block">
                      Rentabilidad / Hora
                    </span>
                    <span className="text-sm font-mono font-extrabold text-emerald-300 tabular-nums block mt-0.5">
                      {cutTimeSummary.avgRevenuePerHour > 0
                        ? `$${cutTimeSummary.avgRevenuePerHour.toLocaleString('es-AR')}/h`
                        : `$${Math.round((client.basePrice / Math.max(10, client.estimatedMinutes)) * 60).toLocaleString('es-AR')}/h`}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Según tiempo real
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <span>Detalle Cronológico de Cortes, Tiempos y Cobros</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {history.records.length} registros
                  </span>
                </div>

                {history.records.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Aún no hay recibos emitidos para este cliente.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
                    {history.records.map((rec, index) => {
                      const durMin =
                        rec.actualDurationMinutes ||
                        durationByInvoiceId.get(rec.id) ||
                        client.estimatedMinutes;
                      const recPhotos = extractInvoicePhotoItems(rec);
                      return (
                        <div
                          key={rec.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {rec.date}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-xs text-slate-500">
                                {rec.invoiceNumber}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[11px] font-mono font-bold text-teal-900">
                                <Clock className="w-3 h-3 text-teal-700" />
                                <span>{durMin} min</span>
                              </span>
                              {recPhotos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('galeria')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                >
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>{recPhotos.length} fotos</span>
                                </button>
                              )}
                              {index === 0 && (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  (Último)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5 break-words">
                              {rec.tasksCompleted.join(' · ')}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2.5">
                            <div>
                              <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                                ${rec.amount.toLocaleString('es-AR')}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  rec.status === 'Pagado'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {rec.status}
                                {rec.paymentMethod ? ` · ${rec.paymentMethod}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectInvoiceReceipt(rec);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Ver Recibo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Galería Fotográfica Antes y Después en la Ficha del Cliente */}
          <div
            data-testid="client-before-after-gallery"
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>Galería Antes y Después en Ficha del Cliente</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {clientGallery.beforeCount} fotos &ldquo;Antes&rdquo; · {clientGallery.afterCount} fotos &ldquo;Después&rdquo; guardadas en el historial de {client.clientName}
                </p>
              </div>

              {onAddClientPhotos && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[11px] font-bold text-amber-900 cursor-pointer inline-flex items-center gap-1">
                    <Camera className="w-3 h-3 text-amber-700" />
                    <span>+ Subir Antes</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleUploadDirectClientPhotos('antes', e)}
                      className="hidden"
                    />
                  </label>
                  <label className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold text-emerald-900 cursor-pointer inline-flex items-center gap-1">
                    <Camera className="w-3 h-3 text-emerald-700" />
                    <span>+ Subir Después</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleUploadDirectClientPhotos('despues', e)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {clientGallery.visitGroups.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                Aún no hay fotos de Antes y Después cargadas en la ficha de este cliente. Al finalizar un corte podés adjuntar múltiples tomas.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {clientGallery.visitGroups.map((group) => (
                  <div
                    key={group.visitKey}
                    data-testid="client-visit-photo-group"
                    className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          Visita {group.date}
                        </span>
                        {group.invoiceNumber && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">
                            {group.invoiceNumber}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-emerald-800">
                        ${group.amount.toLocaleString('es-AR')} · {group.totalPhotos} fotos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Antes */}
                      <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-200/80 space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center justify-between">
                          <span>ANTES DEL CORTE</span>
                          <span className="font-mono">{group.beforePhotos.length}</span>
                        </div>
                        {group.beforePhotos.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.beforePhotos.map((ph) => (
                              <button
                                key={ph.id}
                                type="button"
                                onClick={() => setLightboxPhoto(ph)}
                                className="relative rounded-md overflow-hidden border border-amber-300 aspect-video bg-slate-900 group cursor-pointer"
                              >
                                <img
                                  src={ph.url}
                                  alt={ph.caption || 'Antes'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-amber-600/90 text-white font-mono text-[9px] font-bold">
                                  ANTES
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="py-3 text-center text-[11px] text-amber-800/70">
                            Sin foto previa
                          </div>
                        )}
                      </div>

                      {/* Después */}
                      <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center justify-between">
                          <span>DESPUÉS DEL CORTE</span>
                          <span className="font-mono">{group.afterPhotos.length}</span>
                        </div>
                        {group.afterPhotos.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.afterPhotos.map((ph) => (
                              <button
                                key={ph.id}
                                type="button"
                                onClick={() => setLightboxPhoto(ph)}
                                className="relative rounded-md overflow-hidden border border-emerald-300 aspect-video bg-slate-900 group cursor-pointer"
                              >
                                <img
                                  src={ph.url}
                                  alt={ph.caption || 'Después'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white font-mono text-[9px] font-bold">
                                  DESPUÉS
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="py-3 text-center text-[11px] text-emerald-800/70">
                            Sin foto posterior
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lightboxPhoto && (
              <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold">
                    {lightboxPhoto.stage === 'antes' ? '🟠 ANTES DEL CORTE' : '🟢 DESPUÉS DEL CORTE'} · {lightboxPhoto.takenAt}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(null)}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] cursor-pointer"
                  >
                    Cerrar vista ampliada
                  </button>
                </div>
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.caption || 'Vista ampliada'}
                  className="w-full max-h-64 object-contain rounded-lg bg-black"
                />
                {lightboxPhoto.caption && (
                  <p className="text-[11px] text-slate-300">{lightboxPhoto.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEditClient(client);
            }}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 break-words cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span>Ajustar Tarifa o Datos del Cliente</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClientFormModalProps {
  isOpen: boolean;
  editingClient: ClientProperty | null;
  prefillData?: Partial<ClientProperty> | null;
  defaultDate?: string;
  defaultTime?: string;
  baseLocation: BaseLocationConfig;
  businessProfile?: BusinessProfileConfig;
  existingProperties?: ClientProperty[];
  onClose: () => void;
  onSaveClient: (
    clientProperty: ClientProperty,
    scheduleOptions: {
      shouldSchedule: boolean;
      scheduledDate: string;
      scheduledTime: string;
    },
    isEditing: boolean
  ) => void;
}

export function ClientFormModal({
  isOpen,
  editingClient,
  prefillData,
  defaultDate = getTodayIsoLocal(),
  defaultTime = '08:30',
  baseLocation,
  businessProfile,
  existingProperties = [],
  onClose,
  onSaveClient,
}: ClientFormModalProps) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState(baseLocation.city);
  const [customTown, setCustomTown] = useState('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<LatLng | null>(
    null
  );
  const [propertyType, setPropertyType] = useState<PropertyType>('Casa');
  const [areaSqm, setAreaSqm] = useState('350');
  const [grassCondition, setGrassCondition] =
    useState<GrassCondition>('Regular');
  const [includesBagging, setIncludesBagging] = useState(true);
  const [frequency, setFrequency] = useState<CutFrequency>('Quincenal');
  const [customPrice, setCustomPrice] = useState('');
  const [accessNotes, setAccessNotes] = useState('');

  // Scheduling fields (Fecha y Horario)
  const [shouldSchedule, setShouldSchedule] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [scheduledTime, setScheduledTime] = useState(defaultTime);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setScheduledDate(defaultDate || getTodayIsoLocal());
    setScheduledTime(defaultTime || '08:30');
  }, [defaultDate, defaultTime, isOpen]);

  useEffect(() => {
    if (editingClient) {
      setClientName(editingClient.clientName);
      setPhone(editingClient.phone);
      setAddress(editingClient.address);
      setNeighborhood(editingClient.neighborhood || baseLocation.city);
      setCustomTown('');
      setPropertyType(editingClient.propertyType);
      setAreaSqm(String(editingClient.areaSqm));
      setGrassCondition(editingClient.grassCondition || 'Regular');
      setIncludesBagging(editingClient.includesBagging ?? true);
      setFrequency(editingClient.frequency);
      setCustomPrice(String(editingClient.basePrice));
      setAccessNotes(editingClient.accessNotes);
      setSelectedCoordinates(editingClient.coordinates);
      setShouldSchedule(false);
      setErrorMsg('');
    } else if (prefillData) {
      setClientName(prefillData.clientName || '');
      setPhone(prefillData.phone || '');
      setAddress(prefillData.address || '');
      setNeighborhood(prefillData.neighborhood || baseLocation.city);
      setCustomTown('');
      setPropertyType(prefillData.propertyType || 'Casa');
      setAreaSqm(String(prefillData.areaSqm || 350));
      setGrassCondition(prefillData.grassCondition || 'Regular');
      setIncludesBagging(prefillData.includesBagging ?? true);
      setFrequency(prefillData.frequency || 'Quincenal');
      setCustomPrice(prefillData.basePrice ? String(prefillData.basePrice) : '');
      setAccessNotes(prefillData.accessNotes || '');
      setSelectedCoordinates(prefillData.coordinates || null);
      setShouldSchedule(true);
      setErrorMsg('');
    } else {
      setClientName('');
      setPhone('');
      setAddress('');
      setNeighborhood(baseLocation.city);
      setCustomTown('');
      setPropertyType('Casa');
      setAreaSqm('350');
      setGrassCondition('Regular');
      setIncludesBagging(true);
      setFrequency('Quincenal');
      setCustomPrice('');
      setAccessNotes('');
      setSelectedCoordinates(null);
      setShouldSchedule(true);
      setErrorMsg('');
    }
  }, [editingClient, prefillData, isOpen, baseLocation.city]);

  if (!isOpen) return null;

  const parsedArea = Math.max(20, Number(areaSqm) || 200);
  const suggestion = calculateSuggestedPrice(
    parsedArea,
    propertyType,
    frequency,
    1,
    grassCondition,
    includesBagging,
    businessProfile
      ? {
          baseRatePerSqm: businessProfile.baseRatePerSqm,
          minServicePrice: businessProfile.minServicePrice,
          tallGrassSurchargePct: businessProfile.tallGrassSurchargePct,
          baggingSurchargePct: businessProfile.baggingSurchargePct,
        }
      : undefined
  );
  const effectivePrice = customPrice
    ? Number(customPrice)
    : suggestion.suggestedPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !address.trim()) {
      setErrorMsg(
        'Por favor ingresa el nombre del cliente y la dirección de la casa, quinta o terreno.'
      );
      return;
    }

    const finalNeighborhood =
      !neighborhood.trim() || neighborhood === 'Mi Ciudad / Base Actual'
        ? baseLocation.city
        : customTown.trim() || neighborhood.trim();

    const resolvedCityInfo = resolveCityCoordinates(finalNeighborhood);
    const baseCoords =
      NEIGHBORHOOD_COORDINATES[finalNeighborhood] ||
      resolvedCityInfo.coordinates ||
      baseLocation.coordinates;
    const offsetLat = ((address.length % 7) - 3) * 0.0024;
    const offsetLng = ((clientName.length % 7) - 3) * 0.0024;

    const defaultTasksByType: Record<PropertyType, string[]> = {
      Casa: [
        'Corte de pasto',
        'Bordeado de vereda y canteros',
        includesBagging ? 'Embolsado y barrido final' : 'Soplado de vereda',
      ],
      Terreno: [
        grassCondition === 'Maleza Pesada'
          ? 'Desmalezado pesado con cuchilla'
          : 'Desmalezado de lote',
        'Limpieza de cordón y cuneta',
        includesBagging ? 'Embolsado de restos' : 'Apilado en frente municipal',
      ],
      Quinta: [
        'Corte de parque con tractor/autopropulsada',
        'Bordeado perimetral',
        'Soplado de senderos y galería',
      ],
    };

    const savedProp: ClientProperty = {
      id: editingClient ? editingClient.id : `prop-${Date.now()}`,
      clientName: clientName.trim(),
      phone: phone.trim() || '+54 9 3462 555100',
      address: address.trim(),
      neighborhood: finalNeighborhood,
      propertyType,
      areaSqm: parsedArea,
      grassCondition,
      includesBagging,
      frequency,
      basePrice: effectivePrice,
      defaultTasks: editingClient
        ? editingClient.defaultTasks
        : defaultTasksByType[propertyType],
      accessNotes:
        accessNotes.trim() || 'Confirmar llegada por WhatsApp al estacionar.',
      coordinates: selectedCoordinates
        ? selectedCoordinates
        : editingClient
        ? editingClient.coordinates
        : {
            lat: Math.round((baseCoords.lat + offsetLat) * 10000) / 10000,
            lng: Math.round((baseCoords.lng + offsetLng) * 10000) / 10000,
          },
      lastCutDate: editingClient ? editingClient.lastCutDate : 'Nuevo',
      nextCutDate: shouldSchedule
        ? scheduledDate
        : editingClient
        ? editingClient.nextCutDate
        : defaultDate,
      estimatedMinutes: suggestion.estimatedMinutes,
      active: true,
    };

    onSaveClient(
      savedProp,
      {
        shouldSchedule,
        scheduledDate: scheduledDate || defaultDate,
        scheduledTime: scheduledTime || '08:30',
      },
      Boolean(editingClient)
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl my-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2
              id="client-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {editingClient
                ? 'Editar Cliente / Terreno'
                : 'Nuevo Cliente y Programación de Corte'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Referencia activa: <span className="font-semibold text-slate-800">{baseLocation.city}</span> ({baseLocation.address})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="client-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre del Cliente / Vecino *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="client-name-input"
                  type="text"
                  placeholder="Ej. Familia Gutiérrez"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="client-phone-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                WhatsApp / Teléfono
              </label>
              <input
                id="client-phone-input"
                type="text"
                placeholder="+54 9 3462 554433"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <CityAutocomplete
                id="client-neighborhood-select"
                label="Ciudad / Localidad (Toda Argentina)"
                placeholder="Escribe ej: Venado, Rosario, Funes, Pilar..."
                value={neighborhood}
                onChange={(val) => setNeighborhood(val)}
                onSelectCity={(sug) => {
                  setNeighborhood(sug.fullName);
                  setSelectedCoordinates(sug.coordinates);
                }}
              />
            </div>

            <div>
              <StreetAddressAutocomplete
                id="client-address-input"
                value={address}
                activeCity={neighborhood || baseLocation.city}
                existingProperties={existingProperties}
                onChange={(val) => {
                  setAddress(val);
                  setErrorMsg('');
                }}
                onSelectSuggestion={(sug) => {
                  setAddress(sug.streetAddress);
                  setSelectedCoordinates(sug.coordinates);
                  if (sug.city) {
                    setNeighborhood(sug.city);
                  }
                  setErrorMsg('');
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="property-type-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tipo de Lote
              </label>
              <select
                id="property-type-select"
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as PropertyType)
                }
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Casa">🏠 Casa</option>
                <option value="Terreno">🌾 Terreno</option>
                <option value="Quinta">🌳 Quinta</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="area-sqm-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Superficie (m²)
              </label>
              <input
                id="area-sqm-input"
                type="number"
                min={20}
                max={20000}
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-mono tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="grass-condition-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Estado Pasto
              </label>
              <select
                id="grass-condition-select"
                value={grassCondition}
                onChange={(e) =>
                  setGrassCondition(e.target.value as GrassCondition)
                }
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Regular">🌱 Regular (&lt;12cm)</option>
                <option value="Alto">🌿 Pasto Alto (20cm)</option>
                <option value="Maleza Pesada">🌾 Maleza / Cardos</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="frequency-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Frecuencia
              </label>
              <select
                id="frequency-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as CutFrequency)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal</option>
                <option value="Mensual">Mensual</option>
                <option value="Única vez">Única vez</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">
                Tarifa Sugerida ({parsedArea} m² · $
                {businessProfile?.baseRatePerSqm || 65}/m² · {grassCondition})
              </div>
              <div className="text-base font-bold font-mono text-emerald-800 tabular-nums mt-0.5 flex items-center gap-2">
                <span>
                  ${suggestion.suggestedPrice.toLocaleString('es-AR')} · ~
                  {suggestion.estimatedMinutes} min
                </span>
                <button
                  type="button"
                  onClick={() => setCustomPrice(String(suggestion.suggestedPrice))}
                  className="px-2 py-0.5 text-[11px] font-sans font-semibold bg-emerald-100 text-emerald-900 rounded-md hover:bg-emerald-200"
                >
                  Usar tarifa sugerida
                </button>
              </div>
            </div>
            <div className="w-36">
              <label
                htmlFor="custom-price-input"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Tarifa Acordada ($)
              </label>
              <input
                id="custom-price-input"
                type="number"
                placeholder={String(suggestion.suggestedPrice)}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono tabular-nums bg-white"
              />
            </div>
          </div>

          {/* Programación en el Calendario con Fecha y Horario */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldSchedule}
                onChange={(e) => setShouldSchedule(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                Programar corte en el Calendario / Agenda con fecha y horario
              </span>
            </label>

            {shouldSchedule && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="schedule-date-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha del Corte
                  </label>
                  <input
                    id="schedule-date-input"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="schedule-time-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Horario de Inicio
                  </label>
                  <input
                    id="schedule-time-input"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="access-notes-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Notas Técnicas del Lote / Portón / Obstáculos
            </label>
            <div
              data-testid="field-access-quick-tags"
              className="flex flex-wrap gap-1.5"
            >
              {[
                '🐕 Perro en patio',
                '🔌 Con enchufe 220V',
                '🪨 Cuidado piedras/tosca',
                '🌾 Solo motoguadaña',
                '🔑 Portón con llave/candado',
              ].map((tag) => {
                const cleanTag = tag.replace(/^[^\s]+\s/, '');
                const isIncluded = accessNotes
                  .toLowerCase()
                  .includes(cleanTag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isIncluded) return;
                      setAccessNotes((prev) =>
                        prev.trim() ? `${prev.trim()} · ${cleanTag}` : cleanTag
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      isIncluded
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <input
              id="access-notes-input"
              type="text"
              placeholder="Ej. Candado clave 1234, perro en patio trasero, tranquera blanca"
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includesBagging}
              onChange={(e) => setIncludesBagging(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>Incluye recolección y embolsado del pasto cortado</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              {editingClient
                ? 'Guardar Cambios'
                : shouldSchedule
                ? `Guardar y Agendar (${scheduledDate})`
                : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ScheduleJobModalProps {
  isOpen: boolean;
  properties: ClientProperty[];
  invoices: InvoiceRecord[];
  preselectedPropertyId?: string | null;
  defaultDate: string;
  defaultTime?: string;
  onClose: () => void;
  onConfirmSchedule: (
    property: ClientProperty,
    scheduledDate: string,
    scheduledTime: string,
    customPrice: number
  ) => void;
  onSwitchToNewClient: (dateStr: string, timeStr: string) => void;
}

export function ScheduleJobModal({
  isOpen,
  properties,
  invoices,
  preselectedPropertyId,
  defaultDate,
  defaultTime = '08:30',
  onClose,
  onConfirmSchedule,
  onSwitchToNewClient,
}: ScheduleJobModalProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(defaultDate);
  const [scheduledTime, setScheduledTime] = useState<string>(defaultTime);
  const [priceInput, setPriceInput] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setScheduledDate(defaultDate || getTodayIsoLocal());
    setScheduledTime(defaultTime || '08:30');
    const initialProp =
      properties.find((p) => p.id === preselectedPropertyId) ||
      properties[0] ||
      null;
    if (initialProp) {
      setSelectedPropertyId(initialProp.id);
      setPriceInput(String(initialProp.basePrice));
    }
  }, [isOpen, preselectedPropertyId, defaultDate, defaultTime, properties]);

  if (!isOpen) return null;

  const selectedProp =
    properties.find((p) => p.id === selectedPropertyId) || null;
  const history = selectedProp
    ? getClientPriceHistory(
        selectedProp.id,
        selectedProp.clientName,
        invoices
      )
    : null;

  const handlePropertyChange = (propId: string) => {
    setSelectedPropertyId(propId);
    const found = properties.find((p) => p.id === propId);
    if (found) {
      setPriceInput(String(found.basePrice));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProp) return;
    const finalPrice = Math.max(
      1000,
      Number(priceInput) || selectedProp.basePrice
    );
    onConfirmSchedule(selectedProp, scheduledDate, scheduledTime, finalPrice);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-job-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2
              id="schedule-job-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Programar Corte en el Calendario
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Elige cliente, día y horario para organizar tu jornada y ruta
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar programación"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="schedule-client-select"
                className="text-xs font-semibold text-slate-700"
              >
                Seleccionar Cliente de la Cartera
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToNewClient(scheduledDate, scheduledTime);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Crear Cliente Nuevo</span>
              </button>
            </div>
            <select
              id="schedule-client-select"
              value={selectedPropertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} — {p.address} ({p.neighborhood})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="modal-sched-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                Fecha del Trabajo
              </label>
              <input
                id="modal-sched-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                required
              />
            </div>

            <div>
              <label
                htmlFor="modal-sched-time"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                <Clock className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                Horario de Inicio
              </label>
              <input
                id="modal-sched-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                required
              />
            </div>
          </div>

          {selectedProp && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-slate-900">
                {selectedProp.propertyType} · {selectedProp.areaSqm} m² · ~
                {selectedProp.estimatedMinutes} min estimados
              </div>
              <div className="text-slate-600">
                Último cobro registrado:{' '}
                {history?.lastAmount ? (
                  <span className="font-mono font-bold text-emerald-800">
                    ${history.lastAmount.toLocaleString('es-AR')} (
                    {history.lastDate})
                  </span>
                ) : (
                  <span>Sin cortes previos</span>
                )}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="modal-sched-price"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Valor Acordado para este Corte ($)
            </label>
            <input
              id="modal-sched-price"
              type="number"
              min={1000}
              step={500}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold tabular-nums"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar en Agenda</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BaseLocationModalProps {
  isOpen: boolean;
  currentBase: BaseLocationConfig;
  isLocatingGps: boolean;
  onClose: () => void;
  onSaveBaseLocation: (newBase: BaseLocationConfig) => void;
  onTriggerLiveGps: () => void;
}

export function BaseLocationModal({
  isOpen,
  currentBase,
  isLocatingGps,
  onClose,
  onSaveBaseLocation,
  onTriggerLiveGps,
}: BaseLocationModalProps) {
  const [city, setCity] = useState(currentBase.city);
  const [address, setAddress] = useState(currentBase.address);
  const [lat, setLat] = useState(String(currentBase.coordinates.lat));
  const [lng, setLng] = useState(String(currentBase.coordinates.lng));

  useEffect(() => {
    if (isOpen) {
      setCity(currentBase.city);
      setAddress(currentBase.address);
      setLat(String(currentBase.coordinates.lat));
      setLng(String(currentBase.coordinates.lng));
    }
  }, [isOpen, currentBase]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetCity: string) => {
    const preset = CITY_PRESETS[presetCity];
    if (!preset) return;
    setCity(preset.city || presetCity);
    setAddress(preset.address || 'Centro');
    setLat(String(preset.coordinates.lat));
    setLng(String(preset.coordinates.lng));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = Number(lat) || currentBase.coordinates.lat;
    const parsedLng = Number(lng) || currentBase.coordinates.lng;
    const safeCity = (city || '').trim() || currentBase.city || 'Rosario, Santa Fe';
    const safeAddress = (address || '').trim() || 'Centro';
    onSaveBaseLocation({
      name: `Base Operativa (${safeCity})`,
      city: safeCity,
      address: safeAddress,
      coordinates: {
        lat: Math.round(parsedLat * 10000) / 10000,
        lng: Math.round(parsedLng * 10000) / 10000,
      },
      source: 'manual',
      updatedAt: new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="base-location-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2
              id="base-location-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Punto de Partida / Ubicación Base del Jardinero
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define desde qué ciudad, barrio o calle inicias la jornada hoy para calcular rutas, kilómetros y clientes cercanos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración de base"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Opción 1: GPS en Tiempo Real por si no está en su casa */}
          <div className="p-4 bg-[#0F291E] text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-mono text-emerald-300 font-semibold">
                OPCIÓN RÁPIDA · UBICACIÓN ACTUAL EN CALLE
              </div>
              <div className="text-sm font-bold">
                ¿No estás en tu casa al iniciar la jornada?
              </div>
              <p className="text-xs text-emerald-100/80">
                Toma las coordenadas GPS actuales de tu teléfono o navegador como referencia de salida.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onTriggerLiveGps();
                onClose();
              }}
              disabled={isLocatingGps}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-400 text-slate-950 rounded-xl hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Crosshair className="w-4 h-4" />
              <span>Usar mi GPS Actual</span>
            </button>
          </div>

          {/* Opción 2: Buscador Predictivo de Ciudades y Calles de toda Argentina */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-200">
            <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
              Escribe las primeras letras de tu ciudad o localidad (por ejemplo{' '}
              <strong>"Venado"</strong> →{' '}
              <strong>"Venado Tuerto, Santa Fe"</strong>) para autocompletar el
              nombre oficial y coordenadas GPS.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <CityAutocomplete
                  id="base-city-input"
                  label="Ciudad o Localidad Base (Argentina)"
                  placeholder="Escribe ej: Venado, Rosario, Córdoba, Pilar..."
                  value={city}
                  onChange={(val) => setCity(val)}
                  onSelectCity={(sug) => {
                    setCity(sug.fullName);
                    setAddress(sug.defaultAddress);
                    setLat(String(sug.coordinates.lat));
                    setLng(String(sug.coordinates.lng));
                  }}
                />
              </div>
              <div>
                <StreetAddressAutocomplete
                  id="base-address-input"
                  label="Dirección / Calle / Punto de Salida"
                  placeholder="Ej. Bv. 25 de Mayo 850 o Av. Pellegrini 1500"
                  value={address}
                  activeCity={city}
                  onChange={(val) => setAddress(val)}
                  onSelectSuggestion={(sug) => {
                    setAddress(sug.streetAddress);
                    setCity(sug.city || city);
                    setLat(String(sug.coordinates.lat));
                    setLng(String(sug.coordinates.lng));
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="base-lat-input"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Latitud de Referencia
                </label>
                <input
                  id="base-lat-input"
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="base-lng-input"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Longitud de Referencia
                </label>
                <input
                  id="base-lng-input"
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Guardar Punto de Partida</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Sí, Eliminar',
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <h2
              id="confirm-delete-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmSheetsActionModalProps {
  isOpen: boolean;
  actionType: 'create' | 'sync';
  spreadsheetTitle: string;
  clientsCount: number;
  invoicesCount: number;
  expensesCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSheetsActionModal({
  isOpen,
  actionType,
  spreadsheetTitle,
  clientsCount,
  invoicesCount,
  expensesCount,
  onCancel,
  onConfirm,
}: ConfirmSheetsActionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sheets-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2
              id="confirm-sheets-title"
              className="text-base font-bold text-slate-900"
            >
              {actionType === 'create'
                ? '¿Crear y sincronizar nueva planilla en Google Sheets?'
                : '¿Actualizar planilla en Google Sheets?'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {actionType === 'create'
                ? `Se creará la hoja de cálculo "${spreadsheetTitle}" en tu cuenta de Google Sheets y se escribirán las 4 pestañas operativas:`
                : `Se sobrescribirán y actualizarán las pestañas operativas en tu planilla conectada de Google Sheets con los datos actuales:`}
            </p>
            <ul className="mt-2.5 space-y-1 text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <li>• {clientsCount} clientes y terrenos en cartera</li>
              <li>• {invoicesCount} recibos e historial de cobros</li>
              <li>• {expensesCount} gastos operativos registrados</li>
              <li>• Resumen actualizado de caja y ganancias</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {actionType === 'create'
                ? 'Confirmar y Crear Planilla'
                : 'Confirmar y Actualizar Sheet'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface InvoiceReceiptModalProps {
  invoice: InvoiceRecord | null;
  paymentProfile?: PaymentProfileConfig;
  businessProfile?: BusinessProfileConfig;
  onEditInvoice?: (invoice: InvoiceRecord) => void;
  onClose: () => void;
}

export function InvoiceReceiptModal({
  invoice,
  paymentProfile,
  businessProfile,
  onEditInvoice,
  onClose,
}: InvoiceReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [printNotice, setPrintNotice] = useState(false);
  const [pdfNotice, setPdfNotice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [includePhotosInReceipt, setIncludePhotosInReceipt] = useState(true);

  useEffect(() => {
    setPrintNotice(false);
    setPdfNotice(false);
    setCopied(false);
    setIncludePhotosInReceipt(true);
  }, [invoice]);

  if (!invoice) return null;

  const receiptPhotos = extractInvoicePhotoItems(invoice);
  const beforeReceipt = receiptPhotos.filter((p) => p.stage === 'antes');
  const afterReceipt = receiptPhotos.filter((p) => p.stage === 'despues');
  const hasReceiptPhotos = receiptPhotos.length > 0;
  const receiptSeal = generateCryptographicReceiptSeal({
    invoiceId: invoice.id,
    clientName: invoice.clientName,
    amount: invoice.amount,
    date: invoice.date,
  });

  const brandName = businessProfile?.appName || 'PastoPro';
  const brandSlogan =
    businessProfile?.slogan || 'Mantenimiento de Parques, Quintas y Lotes';
  const ownerPhone = businessProfile?.ownerPhone || '';
  const aliasText = paymentProfile?.alias || 'mi.alias.cobro';
  const holderText =
    businessProfile?.ownerName ||
    paymentProfile?.holderName ||
    'Titular del Servicio';
  const bankText =
    paymentProfile?.bankName || 'Mercado Pago / Transferencia Bancaria';

  const whatsappText = `Hola ${invoice.clientName}, te envío el comprobante ${invoice.invoiceNumber} (${receiptSeal.sealCode}) de ${brandName} por el servicio de corte y mantenimiento en ${invoice.address} (${invoice.areaSqm} m²).
• Total: $${invoice.amount.toLocaleString('es-AR')} (${invoice.status})${
    hasReceiptPhotos && includePhotosInReceipt
      ? `\n• Registro fotográfico Antes y Después (${beforeReceipt.length} Antes / ${afterReceipt.length} Después) adjunto en el comprobante.`
      : ''
  }
• Alias para transferencia: ${aliasText} (Titular: ${holderText} - ${bankText})
• Próxima visita estimada: ${invoice.nextScheduledDate || 'A coordinar / Servicio puntual'}.
¡Muchas gracias!`;
  const cleanPhone = invoice.phone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`;

  const handleCopySummary = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(whatsappText).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrintAndDownloadReceipt = async () => {
    setIsGeneratingPng(true);
    try {
      const ok = await downloadReceiptAsPng(
        invoice,
        paymentProfile,
        businessProfile,
        includePhotosInReceipt
      );
      if (ok) {
        setPrintNotice(true);
        setTimeout(() => setPrintNotice(false), 5000);
      }
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const ok = await downloadReceiptAsPdf(
        invoice,
        paymentProfile,
        businessProfile,
        includePhotosInReceipt
      );
      if (ok) {
        setPdfNotice(true);
        setTimeout(() => setPdfNotice(false), 5000);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div
        id="printable-receipt-sheet"
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 shadow-xl my-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            {businessProfile?.logoUrl ? (
              <img
                src={businessProfile.logoUrl}
                alt={brandName}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                style={{
                  backgroundColor: businessProfile?.brandColor || '#059669',
                }}
                className="w-11 h-11 rounded-xl text-white font-display font-bold text-base flex items-center justify-center shrink-0"
              >
                {brandName[0]?.toUpperCase() || 'P'}
              </div>
            )}
            <div>
              <div className="text-[11px] font-mono text-emerald-800 font-bold">
                {brandName.toUpperCase()} · {invoice.invoiceNumber} ·{' '}
                <span data-testid="receipt-crypto-seal">{receiptSeal.sealCode}</span>
              </div>
              <h2
                id="receipt-modal-title"
                className="text-lg font-bold text-slate-900 mt-0.5"
              >
                {invoice.clientName}
              </h2>
              <p className="text-xs text-slate-500">
                {brandSlogan}
                {ownerPhone ? ` · Tel: ${ownerPhone}` : ''}
              </p>
            </div>
          </div>
          <div className="no-print flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comprobante"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="py-4 space-y-3 text-sm">
          {pdfNotice && (
            <div
              data-testid="receipt-pdf-downloaded-banner"
              className="no-print p-3 bg-teal-950 border border-teal-500/40 text-teal-100 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200"
            >
              <Check className="w-4 h-4 text-teal-300 shrink-0" />
              <span>
                ¡Comprobante oficial <strong>{invoice.invoiceNumber}.pdf</strong> descargado
                {hasReceiptPhotos && includePhotosInReceipt
                  ? ' con fotos Antes y Después incluidas!'
                  : ' exitosamente!'}
              </span>
            </div>
          )}
          {printNotice && (
            <div
              data-testid="receipt-png-downloaded-banner"
              className="no-print p-3 bg-emerald-950 border border-emerald-500/40 text-emerald-100 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200"
            >
              <Check className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>
                ¡Imagen PNG <strong>{invoice.invoiceNumber}.png</strong> guardada
                {hasReceiptPhotos && includePhotosInReceipt
                  ? ' con fotos Antes y Después adjuntas para WhatsApp!'
                  : ' para compartir por WhatsApp!'}
              </span>
            </div>
          )}

          {hasReceiptPhotos && (
            <div
              data-testid="receipt-before-after-gallery"
              className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50 p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold text-emerald-950">
                <span>
                  EVIDENCIA ANTES Y DESPUÉS ({receiptPhotos.length} fotos)
                </span>
                <span className="text-emerald-800 text-[10px]">
                  {includePhotosInReceipt
                    ? '✓ Adjuntas al descargar'
                    : 'No adjuntar al descargar'}
                </span>
              </div>

              {/* Interactive Before/After Comparison Slider when both stages exist */}
              {beforeReceipt.length > 0 && afterReceipt.length > 0 && (
                <BeforeAfterSlider
                  beforeUrl={beforeReceipt[0].url}
                  afterUrl={afterReceipt[0].url}
                  clientName={invoice.clientName}
                  dateStr={invoice.date}
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                {beforeReceipt.map((p, idx) => (
                  <div
                    key={p.id}
                    className="relative rounded-lg overflow-hidden border border-stone-300 aspect-video bg-slate-900"
                  >
                    <img
                      src={p.url}
                      alt={`Antes ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-stone-950/80 text-amber-300 font-mono text-[9px] font-bold">
                      ANTES #{idx + 1}
                    </span>
                  </div>
                ))}
                {afterReceipt.map((p, idx) => (
                  <div
                    key={p.id}
                    className="relative rounded-lg overflow-hidden border border-stone-300 aspect-video bg-slate-900"
                  >
                    <img
                      src={p.url}
                      alt={`Después ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-stone-950/80 text-emerald-300 font-mono text-[9px] font-bold">
                      DESPUÉS #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              <label
                data-testid="toggle-receipt-embed-photos"
                className="no-print flex items-center justify-between gap-2 pt-2 border-t border-stone-200/80 text-xs text-slate-700 cursor-pointer select-none"
              >
                <span className="font-medium">
                  Incluir fotos “Antes y Después” al descargar PDF / PNG
                </span>
                <input
                  type="checkbox"
                  checked={includePhotosInReceipt}
                  onChange={(e) => setIncludePhotosInReceipt(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* Bloque Principal: Fecha, Dirección, Tareas Principales y Precio Total */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-stone-200/80">
              <div>
                <span className="text-[11px] text-stone-500 block">
                  Fecha del servicio
                </span>
                <span className="font-mono text-sm font-bold text-stone-950 tabular-nums">
                  {invoice.date}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-stone-500 block">
                  Estado de pago
                </span>
                <span className="text-sm font-semibold text-stone-950">
                  {invoice.status}
                  {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ''}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-stone-500 block">
                Dirección del inmueble / Lote
              </span>
              <div className="text-sm font-bold text-stone-950 mt-0.5">
                {invoice.address}
                {invoice.neighborhood ? ` · ${invoice.neighborhood}` : ''}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                {invoice.propertyType} · {invoice.areaSqm} m² · Próxima visita:{' '}
                <span className="font-mono text-stone-800">
                  {invoice.nextScheduledDate}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-stone-200/80">
              <div className="text-xs font-semibold text-stone-800 mb-1.5">
                Tareas principales realizadas:
              </div>
              <ul className="space-y-1 text-xs text-stone-700">
                {invoice.tasksCompleted.map((task, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold">✓</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <span className="text-sm font-bold text-stone-950">
                Precio Total del Servicio
              </span>
              <span className="text-2xl font-extrabold font-mono text-emerald-800 tabular-nums">
                ${invoice.amount.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Datos Bancarios / Alias para Transferencia — Sin desborde de CBU al imprimir */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/90 rounded-xl text-xs space-y-1.5 overflow-hidden">
            <div className="font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-2">
              <span>Datos para Transferencia / MercadoPago</span>
              <span className="font-mono text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200 break-all">
                Alias: {aliasText}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1 text-stone-700 font-mono text-[11px] pt-1 border-t border-emerald-200/60">
              <div className="break-words">
                <span className="font-semibold text-stone-900">Titular:</span>{' '}
                {holderText} · {bankText}
              </div>
              {paymentProfile?.cbu && (
                <div className="break-all">
                  <span className="font-semibold text-stone-900">
                    CBU / CVU:
                  </span>{' '}
                  {paymentProfile.cbu}
                </div>
              )}
              {paymentProfile?.cuit && (
                <div className="break-all">
                  <span className="font-semibold text-stone-900">CUIT:</span>{' '}
                  {paymentProfile.cuit}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1.5">
            {onEditInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditInvoice(invoice);
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5 text-emerald-700" />
                <span>Editar Recibo</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopySummary}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="download-receipt-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              title="Descargar comprobante en formato PDF estándar vectorial"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-950 bg-teal-50 border border-teal-300 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              <span>{isGeneratingPdf ? 'Generando...' : pdfNotice ? '✓ PDF Listo' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              data-testid="download-receipt-png-btn"
              onClick={handlePrintAndDownloadReceipt}
              disabled={isGeneratingPng}
              title="Descargar comprobante en formato imagen PNG de alta resolución"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isGeneratingPng ? 'Generando...' : printNotice ? '✓ PNG Listo' : 'Descargar PNG'}</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              <span>Enviar WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditScheduledJobModalProps {
  job: ScheduledJob | null;
  baseLocation: BaseLocationConfig;
  existingProperties: ClientProperty[];
  invoices: InvoiceRecord[];
  onClose: () => void;
  onSaveScheduledJob: (
    updatedJob: ScheduledJob,
    alsoUpdateClientProperty: boolean
  ) => void;
  onDeleteScheduledJob: (jobId: string, clientName: string) => void;
}

export function EditScheduledJobModal({
  job,
  baseLocation,
  existingProperties,
  invoices,
  onClose,
  onSaveScheduledJob,
  onDeleteScheduledJob,
}: EditScheduledJobModalProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [coordinates, setCoordinates] = useState<LatLng>({
    lat: -33.7456,
    lng: -61.9688,
  });
  const [tasksText, setTasksText] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [alsoUpdateClientProperty, setAlsoUpdateClientProperty] =
    useState(true);

  useEffect(() => {
    if (job) {
      setScheduledDate(job.scheduledDate);
      setScheduledTime(job.scheduledTime || '08:30');
      setPrice(String(job.price));
      setAddress(job.address);
      setNeighborhood(job.neighborhood);
      setCoordinates(job.coordinates);
      setTasksText(job.tasks.join(', '));
      setAccessNotes(job.accessNotes || '');
      setAlsoUpdateClientProperty(true);
    }
  }, [job]);

  if (!job) return null;

  const clientHistory = getClientPriceHistory(
    job.propertyId,
    job.clientName,
    invoices
  );

  const shiftJobDateByDays = (deltaDays: number) => {
    const base = new Date(`${scheduledDate || job.scheduledDate}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) return;
    base.setUTCDate(base.getUTCDate() + deltaDays);
    setScheduledDate(base.toISOString().slice(0, 10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Math.max(1000, Number(price) || job.price);
    const parsedTasks = tasksText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedJob: ScheduledJob = {
      ...job,
      scheduledDate: scheduledDate || job.scheduledDate,
      scheduledTime: scheduledTime || '08:30',
      price: parsedPrice,
      address: address.trim() || job.address,
      neighborhood: neighborhood.trim() || job.neighborhood,
      coordinates,
      tasks: parsedTasks.length > 0 ? parsedTasks : job.tasks,
      accessNotes: accessNotes.trim(),
    };

    onSaveScheduledJob(updatedJob, alsoUpdateClientProperty);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-scheduled-job-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-xl my-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-mono font-semibold text-emerald-800 uppercase">
              MODIFICAR CITA / CORTE PROGRAMADO
            </div>
            <h2
              id="edit-scheduled-job-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              {job.clientName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cambia el día, el horario, la dirección o el precio sin tener que
              borrar la cita.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición de cita"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Fecha y Horario con botones rápidos */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-job-date-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                  Fecha de la Cita
                </label>
                <input
                  id="edit-job-date-input"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white"
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => shiftJobDateByDays(1)}
                    className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                  >
                    +1 día (Mañana)
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftJobDateByDays(7)}
                    className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                  >
                    +7 días
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-job-time-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                  Horario del Corte
                </label>
                <input
                  id="edit-job-time-input"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white"
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['08:00', '09:30', '11:00', '14:30', '16:30'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScheduledTime(t)}
                      className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md border ${
                        scheduledTime === t
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Precio Acordado */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="edit-job-price-input"
                className="text-xs font-bold text-slate-800"
              >
                Precio para este Corte ($)
              </label>
              {clientHistory.lastAmount && (
                <span className="text-[11px] font-mono text-emerald-800">
                  Último cobro: ${clientHistory.lastAmount.toLocaleString('es-AR')}
                </span>
              )}
            </div>
            <input
              id="edit-job-price-input"
              type="number"
              min={1000}
              step={500}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold tabular-nums"
              required
            />
          </div>

          {/* Dirección con Autocompletado de Calles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <StreetAddressAutocomplete
                id="edit-job-address-input"
                label="Calle / Dirección del Lote"
                value={address}
                activeCity={baseLocation.city}
                existingProperties={existingProperties}
                onChange={(val) => setAddress(val)}
                onSelectSuggestion={(sug) => {
                  setAddress(sug.streetAddress);
                  setNeighborhood(sug.neighborhood);
                  setCoordinates(sug.coordinates);
                }}
              />
            </div>

            <div>
              <label
                htmlFor="edit-job-neighborhood-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Barrio / Localidad
              </label>
              <input
                id="edit-job-neighborhood-input"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Tareas con Dibujos (1 Toque sin escribir) + Notas con Voz */}
          <div className="space-y-3">
            <div>
              <span className="block text-xs font-bold text-slate-800 mb-1.5">
                Tareas Incluidas en la Visita:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                {TASK_QUICK_PRESETS.map((preset) => {
                  const active =
                    tasksText
                      .toLowerCase()
                      .includes(preset.shortTitle.toLowerCase()) ||
                    tasksText
                      .toLowerCase()
                      .includes(preset.taskText.toLowerCase());
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const currentList = tasksText
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean);
                        if (active) {
                          const filtered = currentList.filter(
                            (t) =>
                              !t
                                .toLowerCase()
                                .includes(preset.shortTitle.toLowerCase()) &&
                              t.toLowerCase() !== preset.taskText.toLowerCase()
                          );
                          setTasksText(filtered.join(', '));
                        } else {
                          const updated = [...currentList, preset.taskText];
                          setTasksText(updated.join(', '));
                        }
                      }}
                      className={`min-h-[38px] p-2 rounded-xl border text-left flex items-center justify-center text-xs font-semibold transition-all ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="leading-tight">{preset.shortTitle}</span>
                    </button>
                  );
                })}
              </div>
              <input
                id="edit-job-tasks-input"
                type="text"
                aria-label="Tareas a realizar"
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="edit-job-notes-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nota de Acceso / Portón
              </label>
              <input
                id="edit-job-notes-input"
                type="text"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoUpdateClientProperty}
              onChange={(e) => setAlsoUpdateClientProperty(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            <span>
              Guardar también estos cambios (precio y dirección) en la ficha del
              cliente
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                onDeleteScheduledJob(job.id, job.clientName);
                onClose();
              }}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar de la Agenda</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Cambios de la Cita</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OfflineQueueAndAliasModalProps {
  isOpen: boolean;
  isOnline: boolean;
  simulatedOffline: boolean;
  swReady: boolean;
  offlineQueue: OfflineSyncAction[];
  pendingCount?: number;
  paymentProfile: PaymentProfileConfig;
  onClose: () => void;
  onToggleSimulatedOffline: (offline: boolean) => void;
  onFlushQueueNow?: () => void;
  onFlushQueue?: () => void;
  onClearSyncedHistory: () => void;
  onSavePaymentProfile: (profile: PaymentProfileConfig) => void;
}

export function OfflineQueueAndAliasModal({
  isOpen,
  isOnline,
  simulatedOffline,
  swReady,
  offlineQueue,
  paymentProfile,
  onClose,
  onToggleSimulatedOffline,
  onFlushQueueNow,
  onFlushQueue,
  onClearSyncedHistory,
  onSavePaymentProfile,
}: OfflineQueueAndAliasModalProps) {
  const [alias, setAlias] = useState(paymentProfile.alias);
  const [cbu, setCbu] = useState(paymentProfile.cbu);
  const [holderName, setHolderName] = useState(paymentProfile.holderName);
  const [bankName, setBankName] = useState(paymentProfile.bankName);

  useEffect(() => {
    if (isOpen) {
      setAlias(paymentProfile.alias);
      setCbu(paymentProfile.cbu);
      setHolderName(paymentProfile.holderName);
      setBankName(paymentProfile.bankName);
    }
  }, [isOpen, paymentProfile]);

  if (!isOpen) return null;

  const pendingItems = offlineQueue.filter((i) => i.status === 'Pendiente');

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePaymentProfile({
      alias: alias.trim() || 'mi.alias.cobro',
      cbu: cbu.trim(),
      holderName: holderName.trim() || 'Titular del Servicio',
      bankName: bankName.trim() || 'Mercado Pago / Transferencia Bancaria',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-alias-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl my-8 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-mono text-emerald-800 font-semibold">
              PERSISTENCIA SERVICE WORKER & DATOS DE COBRO
            </div>
            <h2
              id="offline-alias-modal-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              Cola Local Offline y Configuración de Alias / CBU
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel offline y alias"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sección 1: Capa de Persistencia Offline (Service Worker + Cola Local) */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-700" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-600" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Estado de Conexión:{' '}
                  <span
                    className={
                      isOnline ? 'text-emerald-700' : 'text-amber-700'
                    }
                  >
                    {isOnline
                      ? 'Conectado (Sincronización Automática Activa)'
                      : 'Modo Campo / Sin Señal (Guardando en Cola Local)'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Service Worker: {swReady ? 'Activo y Cacheado' : 'Registrado'}{' '}
                  · {pendingItems.length} pendientes de sincronizar
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleSimulatedOffline(!simulatedOffline)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                  simulatedOffline
                    ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                }`}
              >
                {simulatedOffline
                  ? 'Reconectar y Sincronizar Cola'
                  : 'Simular Modo Sin Señal (Ruta/Campo)'}
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>
                Cola Local de Acciones (Completar Corte, Crear Cliente, Tarifas)
              </span>
              <div className="flex items-center gap-2">
                {pendingItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onFlushQueueNow || onFlushQueue}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sincronizar ({pendingItems.length})</span>
                  </button>
                )}
                {offlineQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearSyncedHistory}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                  >
                    Limpiar sincronizados
                  </button>
                )}
              </div>
            </div>

            {offlineQueue.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No hay acciones pendientes en la cola. Si cortas el pasto en una
                quinta o pueblo sin señal, cada cobro o cliente nuevo se
                guardará aquí y se sincronizará solo al volver la señal.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
                {offlineQueue.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {item.detail} · Creado: {item.createdAt}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                        item.status === 'Pendiente'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {item.status === 'Pendiente'
                        ? 'En Cola Offline'
                        : item.syncedAt || 'Sincronizado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sección 2: Configuración de Alias / CBU para Recibos y Presupuestos */}
        <form
          onSubmit={handleSaveAlias}
          className="space-y-3 pt-2 border-t border-slate-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <CreditCard className="w-4 h-4 text-emerald-700" />
            <span>
              Alias / CBU para Recibos y Presupuestos de WhatsApp
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payment-alias-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alias Bancario / MercadoPago
              </label>
              <input
                id="payment-alias-input"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Ej. mi.empresa.mp"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="payment-holder-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre del Titular
              </label>
              <input
                id="payment-holder-input"
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Ej. Martín Gómez"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="payment-bank-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Banco / Billetera
              </label>
              <input
                id="payment-bank-input"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ej. Mercado Pago / Banco Nación"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="payment-cbu-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                CBU / CVU (Opcional)
              </label>
              <input
                id="payment-cbu-input"
                type="text"
                value={cbu}
                onChange={(e) => setCbu(e.target.value)}
                placeholder="00000031000..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Guardar Alias / CBU</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditInvoiceModalProps {
  invoice: InvoiceRecord | null;
  onClose: () => void;
  onSaveInvoice: (
    updatedInvoice: InvoiceRecord,
    syncClientBasePrice: boolean
  ) => void;
}

export function EditInvoiceModal({
  invoice,
  onClose,
  onSaveInvoice,
}: EditInvoiceModalProps) {
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [status, setStatus] = useState<PaymentStatus>('Pagado');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Transferencia');
  const [nextScheduledDate, setNextScheduledDate] = useState('');
  const [tasksText, setTasksText] = useState('');
  const [syncClientBasePrice, setSyncClientBasePrice] = useState(true);

  useEffect(() => {
    if (invoice) {
      setClientName(invoice.clientName);
      setAddress(invoice.address);
      setNeighborhood(invoice.neighborhood || 'Zona Centro');
      setDate(invoice.date);
      setAmount(String(invoice.amount));
      setDurationMinutes(String(invoice.actualDurationMinutes || 45));
      setStatus(invoice.status);
      setPaymentMethod(invoice.paymentMethod || 'Transferencia');
      setNextScheduledDate(invoice.nextScheduledDate);
      setTasksText(invoice.tasksCompleted.join(', '));
      setSyncClientBasePrice(true);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.max(1000, Number(amount) || invoice.amount);
    const parsedDuration = Math.max(
      5,
      Math.round(Number(durationMinutes) || invoice.actualDurationMinutes || 45)
    );
    const parsedTasks = tasksText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSaveInvoice(
      {
        ...invoice,
        clientName: clientName.trim() || invoice.clientName,
        address: address.trim() || invoice.address,
        neighborhood: neighborhood.trim() || invoice.neighborhood,
        date: date || invoice.date,
        amount: parsedAmount,
        actualDurationMinutes: parsedDuration,
        status,
        paymentMethod: status === 'Pagado' ? paymentMethod : undefined,
        paidAt: status === 'Pagado' ? date || invoice.date : undefined,
        nextScheduledDate: nextScheduledDate || invoice.nextScheduledDate,
        tasksCompleted:
          parsedTasks.length > 0 ? parsedTasks : invoice.tasksCompleted,
      },
      syncClientBasePrice
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-invoice-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-xl my-4 space-y-4 break-words">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div className="min-w-0">
            <div className="text-[11px] font-mono font-bold text-emerald-800">
              EDITAR COMPROBANTE EMITIDO · {invoice.invoiceNumber}
            </div>
            <h2
              id="edit-invoice-modal-title"
              className="text-lg font-bold text-slate-900 mt-0.5 break-words"
            >
              Corregir Datos del Recibo, Tiempo y Cobro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición de recibo"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="edit-invoice-client-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre del Cliente
              </label>
              <input
                id="edit-invoice-client-input"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="edit-invoice-amount-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Monto Cobrado ($)
              </label>
              <input
                id="edit-invoice-amount-input"
                type="number"
                min={1000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="edit-invoice-duration-input"
                className="block text-xs font-semibold text-teal-900 mb-1"
              >
                Tiempo Corte (min)
              </label>
              <input
                id="edit-invoice-duration-input"
                type="number"
                min={5}
                max={600}
                step={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold text-teal-900 border border-teal-300 rounded-lg tabular-nums bg-teal-50/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-invoice-address-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Dirección del Lote
              </label>
              <input
                id="edit-invoice-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="edit-invoice-neighborhood-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Barrio / Localidad
              </label>
              <input
                id="edit-invoice-neighborhood-input"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-invoice-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Fecha del Servicio
              </label>
              <input
                id="edit-invoice-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="edit-invoice-next-date-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Próximo Corte Programado
              </label>
              <input
                id="edit-invoice-next-date-input"
                type="date"
                value={nextScheduledDate}
                onChange={(e) => setNextScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-invoice-status-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Estado del Cobro
              </label>
              <select
                id="edit-invoice-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente (Cuenta Corriente)</option>
              </select>
            </div>

            {status === 'Pagado' && (
              <div>
                <label
                  htmlFor="edit-invoice-method-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Medio de Pago
                </label>
                <select
                  id="edit-invoice-method-select"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Mano</option>
                  <option value="MercadoPago">MercadoPago</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-invoice-tasks-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Tareas Realizadas (separadas por coma)
            </label>
            <input
              id="edit-invoice-tasks-input"
              type="text"
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={syncClientBasePrice}
              onChange={(e) => setSyncClientBasePrice(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            <span className="break-words">
              Actualizar también la tarifa habitual en la ficha de este cliente
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Cambios del Recibo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BusinessProfileModalProps {
  isOpen: boolean;
  businessProfile: BusinessProfileConfig;
  paymentProfile: PaymentProfileConfig;
  onClose: () => void;
  onSaveBusinessAndPayment: (
    business: BusinessProfileConfig,
    payment: PaymentProfileConfig
  ) => void;
}

const BUSINESS_NAME_PRESETS = [
  'PastoPro',
  'Cortes El Trébol',
  'Jardinería Hernández',
  'Parques y Quintas del Sur',
  'Jardinería Integral',
];

export function BusinessProfileModal({
  isOpen,
  businessProfile,
  paymentProfile,
  onClose,
  onSaveBusinessAndPayment,
}: BusinessProfileModalProps) {
  const [appName, setAppName] = useState(businessProfile.appName);
  const [slogan, setSlogan] = useState(businessProfile.slogan);
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName);
  const [ownerPhone, setOwnerPhone] = useState(businessProfile.ownerPhone);
  const [baseRatePerSqm, setBaseRatePerSqm] = useState(
    String(businessProfile.baseRatePerSqm)
  );
  const [minServicePrice, setMinServicePrice] = useState(
    String(businessProfile.minServicePrice)
  );

  const [alias, setAlias] = useState(paymentProfile.alias);
  const [bankName, setBankName] = useState(paymentProfile.bankName);
  const [cbu, setCbu] = useState(paymentProfile.cbu);

  useEffect(() => {
    if (isOpen) {
      setAppName(businessProfile.appName);
      setSlogan(businessProfile.slogan);
      setOwnerName(businessProfile.ownerName);
      setOwnerPhone(businessProfile.ownerPhone);
      setBaseRatePerSqm(String(businessProfile.baseRatePerSqm));
      setMinServicePrice(String(businessProfile.minServicePrice));
      setAlias(paymentProfile.alias);
      setBankName(paymentProfile.bankName);
      setCbu(paymentProfile.cbu);
    }
  }, [isOpen, businessProfile, paymentProfile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAppName = appName.trim() || 'Mi Empresa de Jardinería';
    const cleanOwner = ownerName.trim() || 'Titular del Servicio';
    onSaveBusinessAndPayment(
      {
        appName: cleanAppName,
        slogan:
          slogan.trim() || 'Mantenimiento de Parques, Quintas y Terrenos',
        ownerName: cleanOwner,
        ownerPhone: ownerPhone.trim(),
        baseRatePerSqm: Math.max(15, Number(baseRatePerSqm) || 65),
        minServicePrice: Math.max(3000, Number(minServicePrice) || 18000),
      },
      {
        alias: alias.trim() || 'mi.alias.cobro',
        holderName: cleanOwner,
        bankName: bankName.trim() || 'Mercado Pago / Transferencia Bancaria',
        cbu: cbu.trim(),
      }
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-profile-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl my-6 space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-[11px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
              PERSONALIZACIÓN DE MARCA PROPIA Y TARIFAS BASE
            </div>
            <h2
              id="business-profile-modal-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              Configurar Nombre de la App y Datos de tu Emprendimiento
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personaliza el nombre que aparece arriba en la app, en tus recibos
              impresos, mensajes de WhatsApp y cálculos de presupuestos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración de emprendimiento"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div>
              <label
                htmlFor="business-app-name-input"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Nombre de la Aplicación / Tu Emprendimiento
              </label>
              <input
                id="business-app-name-input"
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Ej. Parques del Sur, Jardinería Integral..."
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500 font-semibold">
                  Ejemplos rápidos:
                </span>
                {BUSINESS_NAME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAppName(preset)}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="business-slogan-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Especialidad / Subtítulo (Sale en los recibos y cabecera)
              </label>
              <input
                id="business-slogan-input"
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ej. Corte de Pasto, Desmalezado y Mantenimiento de Quintas"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="business-owner-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre del Titular / Responsable
              </label>
              <input
                id="business-owner-name-input"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Martín Gómez"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="business-owner-phone-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                WhatsApp / Teléfono de tu Emprendimiento
              </label>
              <input
                id="business-owner-phone-input"
                type="text"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Ej. 3462-558899"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-900">
              Tarifas Base para el Cotizador Automático y Nuevos Lotes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="business-rate-sqm-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Valor Base por Metro Cuadrado ($/m²)
                </label>
                <input
                  id="business-rate-sqm-input"
                  type="number"
                  min={1}
                  step={1}
                  value={baseRatePerSqm}
                  onChange={(e) => setBaseRatePerSqm(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="business-min-price-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Precio Mínimo por Salida / Corte ($)
                </label>
                <input
                  id="business-min-price-input"
                  type="number"
                  min={1000}
                  step={100}
                  value={minServicePrice}
                  onChange={(e) => setMinServicePrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="business-alias-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alias de Cobro
              </label>
              <input
                id="business-alias-input"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="business-bank-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Banco / Billetera
              </label>
              <input
                id="business-bank-input"
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="business-cbu-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                CBU / CVU (Opcional)
              </label>
              <input
                id="business-cbu-input"
                type="text"
                value={cbu}
                onChange={(e) => setCbu(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Identidad y Tarifas</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

