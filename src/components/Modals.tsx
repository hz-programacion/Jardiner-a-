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
  History,
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
  LatLng,
  OfflineSyncAction,
  PaymentMethod,
  PaymentProfileConfig,
  PaymentStatus,
  PropertyType,
  ScheduledJob,
} from '../types/lawn';
import {
  calculateSuggestedPrice,
  computeNextCutDate,
  getClientPriceHistory,
} from '../utils/lawnLogic';
import { CITY_PRESETS, NEIGHBORHOOD_COORDINATES } from '../data/seedData';
import { StreetAddressAutocomplete } from './StreetAddressAutocomplete';
import { downloadReceiptAsPng } from '../utils/receiptPrinter';
import { SpeakButton, VoiceDictationButton } from './AccessibilityVoiceBar';
import {
  VISUAL_TASK_PRESETS,
  buildReceiptSpeech,
  formatSpokenPesos,
  speakTextInSpanish,
} from '../utils/accessibilityAndVoice';

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
      <rect x="30" y="25" width="320" height="36" rx="8" fill="#0F291E"/>
      <text x="45" y="48" fill="#ffffff" font-family="sans-serif" font-size="15" font-weight="bold">EVIDENCIA DE CORTE · LOTE TERMINADO</text>
      <rect x="30" y="265" width="440" height="34" rx="6" fill="#0F291E" fill-opacity="0.85"/>
      <text x="44" y="287" fill="#a7f3d0" font-family="monospace" font-size="13" font-weight="bold">PastoPro · Corte, Bordeado y Limpieza Verificada</text>
    </svg>`
  );

interface CompleteJobModalProps {
  job: ScheduledJob | null;
  invoices: InvoiceRecord[];
  paymentProfile?: PaymentProfileConfig;
  isOnline?: boolean;
  onClose: () => void;
  onConfirmComplete: (
    jobId: string,
    paidNow: boolean,
    paymentMethod: PaymentMethod,
    finalPrice: number,
    updateClientBasePrice: boolean,
    photoUrl?: string
  ) => void;
}

export function CompleteJobModal({
  job,
  invoices,
  paymentProfile,
  isOnline = true,
  onClose,
  onConfirmComplete,
}: CompleteJobModalProps) {
  const [paidNow, setPaidNow] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Transferencia');
  const [finalPrice, setFinalPrice] = useState<string>(
    job ? String(job.price) : '0'
  );
  const [updateClientBasePrice, setUpdateClientBasePrice] =
    useState<boolean>(true);
  const [photoUrl, setPhotoUrl] = useState<string>('');

  useEffect(() => {
    if (job) {
      setFinalPrice(String(job.price));
      setPaidNow(true);
      setPaymentMethod('Transferencia');
      setUpdateClientBasePrice(true);
      setPhotoUrl(job.photoUrl || '');
    }
  }, [job]);

  if (!job) return null;

  const nextDate = computeNextCutDate(job.scheduledDate, job.frequency);
  const clientHistory = getClientPriceHistory(
    job.propertyId,
    job.clientName,
    invoices
  );
  const referenceLastAmount = clientHistory.lastAmount || job.price;

  const applyQuickAdjustment = (multiplier: number) => {
    const rounded = Math.round((referenceLastAmount * multiplier) / 500) * 500;
    setFinalPrice(String(rounded));
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Math.max(1000, Number(finalPrice) || job.price);
    onConfirmComplete(
      job.id,
      paidNow,
      paymentMethod,
      parsedPrice,
      updateClientBasePrice,
      photoUrl || undefined
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-job-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl my-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2
              id="complete-job-title"
              className="text-lg font-bold text-slate-900"
            >
              ✅ Completar Corte y Emitir Recibo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {job.clientName} · {job.address} ({job.neighborhood})
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <SpeakButton
              text={`Cobrar corte de ${job.clientName}, en ${job.address}. Monto a cobrar hoy: ${formatSpokenPesos(
                Number(finalPrice) || job.price
              )}. ${
                clientHistory.lastAmount
                  ? `Último cobro anterior: ${formatSpokenPesos(clientHistory.lastAmount)}.`
                  : 'Es su primer corte.'
              }`}
              label="🔊 Escuchar"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!isOnline && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Modo Sin Señal (Offline):</strong> El corte y recibo se
                guardarán en la cola del Service Worker y se sincronizarán al
                recuperar conexión.
              </span>
            </div>
          )}

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-700" />
                <span>¿Cuánto le cobraste antes a {job.clientName}?</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-800">
                {clientHistory.totalCutsCount} cortes reg.
              </span>
            </div>

            {clientHistory.records.length > 0 ? (
              <div className="space-y-1">
                {clientHistory.records.slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-slate-600">
                      {idx === 0 ? 'Último cobro' : 'Anterior'} ({rec.date}):
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      ${rec.amount.toLocaleString('es-AR')}{' '}
                      <span className="font-sans font-normal text-slate-500">
                        ({rec.paymentMethod || rec.status})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Primer corte registrado para este cliente. Tarifa base: $
                {job.price.toLocaleString('es-AR')}
              </p>
            )}

            <div className="pt-1.5 border-t border-emerald-200/70">
              <div className="text-[11px] text-slate-600 mb-1.5">
                Fijar precio rápido según último cobro ($
                {referenceLastAmount.toLocaleString('es-AR')}):
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuickAdjustment(1)}
                  className="py-1.5 px-2 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-mono"
                >
                  Igual
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickAdjustment(1.1)}
                  className="py-1.5 px-2 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-mono"
                >
                  +10%
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickAdjustment(1.15)}
                  className="py-1.5 px-2 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-mono"
                >
                  +15%
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickAdjustment(1.2)}
                  className="py-1.5 px-2 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-mono"
                >
                  +20%
                </button>
              </div>
            </div>
          </div>

          <div>
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
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updateClientBasePrice}
                onChange={(e) => setUpdateClientBasePrice(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              <span>
                Guardar este monto como la nueva tarifa habitual del cliente
              </span>
            </label>
          </div>

          {/* Opción 2: Foto "Antes / Después" del Lote Terminado */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-700" />
                <span>Foto del Lote Terminado (Comprobante)</span>
              </span>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="text-[11px] font-semibold text-red-600 hover:underline"
                >
                  Quitar foto
                </button>
              )}
            </div>

            {photoUrl ? (
              <div className="rounded-lg overflow-hidden border border-emerald-300 bg-white">
                <img
                  src={photoUrl}
                  alt="Evidencia del lote cortado"
                  className="w-full h-28 object-cover"
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[36px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Sacar / Subir Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(SAMPLE_COMPLETED_LAWN_SVG)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  + Adjuntar Evidencia de Corte
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Estado del Cobro (Tocá una opción)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaidNow(true);
                  speakTextInSpanish('Cobrado ahora mismo');
                }}
                className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-extrabold border transition-colors whitespace-nowrap ${
                  paidNow
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                💵 Cobrado Ahora
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaidNow(false);
                  speakTextInSpanish('Dejar pendiente en cuenta corriente');
                }}
                className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-extrabold border transition-colors whitespace-nowrap ${
                  !paidNow
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                ⏳ Quedó Debiendo
              </button>
            </div>
          </div>

          {paidNow && (
            <div>
              <label
                htmlFor="payment-method-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Medio de Pago Recibido (Con Dibujos)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(
                  [
                    { id: 'Efectivo', emoji: '💵', label: 'Efectivo' },
                    { id: 'Transferencia', emoji: '📲', label: 'Transferencia' },
                    { id: 'MercadoPago', emoji: '📱', label: 'MercadoPago' },
                  ] as const
                ).map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(pm.id);
                      speakTextInSpanish(`Pago con ${pm.label}`);
                    }}
                    className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all ${
                      paymentMethod === pm.id
                        ? 'bg-[#0B2219] text-white border-[#0B2219]'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{pm.emoji}</span>
                    <span>{pm.label}</span>
                  </button>
                ))}
              </div>
              <select
                id="payment-method-select"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Transferencia">
                  📲 Transferencia Bancaria / Alias ({paymentProfile?.alias || 'pastopro.venado'})
                </option>
                <option value="Efectivo">💵 Efectivo en mano</option>
                <option value="MercadoPago">📱 MercadoPago</option>
              </select>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <div>
              Próxima visita ({job.frequency}): programada para el{' '}
              <span className="font-mono font-semibold text-slate-900">
                {nextDate}
              </span>
              .
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
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
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
  onClose: () => void;
  onEditClient: (client: ClientProperty) => void;
  onSelectInvoiceReceipt: (invoice: InvoiceRecord) => void;
}

export function ClientHistoryModal({
  client,
  invoices,
  onClose,
  onEditClient,
  onSelectInvoiceReceipt,
}: ClientHistoryModalProps) {
  if (!client) return null;

  const history = getClientPriceHistory(
    client.id,
    client.clientName,
    invoices
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-history-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Historial de Precios y Visitas por Cliente
            </div>
            <h2
              id="client-history-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              {client.clientName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {client.address} · {client.neighborhood} ({client.propertyType} ·{' '}
              {client.areaSqm} m²)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">
                Tarifa Actual
              </div>
              <div className="text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                ${client.basePrice.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] text-slate-500">{client.frequency}</div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-[11px] text-emerald-900 font-medium">
                Último Cobro
              </div>
              <div className="text-base font-bold font-mono text-emerald-800 tabular-nums mt-0.5">
                {history.lastAmount
                  ? `$${history.lastAmount.toLocaleString('es-AR')}`
                  : 'Sin reg.'}
              </div>
              <div className="text-[11px] text-emerald-800 font-mono">
                {history.lastDate || client.lastCutDate}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">
                Cobro Anterior
              </div>
              <div className="text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5">
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

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[11px] text-slate-500 font-medium">
                Total Histórico
              </div>
              <div className="text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                ${history.totalBilled.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] text-slate-500">
                {history.totalCutsCount} cortes hechos
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Detalle Cronológico de Cortes y Cobros</span>
              <span className="font-mono text-[11px] text-slate-500">
                {history.records.length} registros
              </span>
            </div>

            {history.records.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Aún no hay recibos emitidos para este cliente.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
                {history.records.map((rec, index) => (
                  <div
                    key={rec.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {rec.date}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-xs text-slate-500">
                          {rec.invoiceNumber}
                        </span>
                        {index === 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            (Último)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
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
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEditClient(client);
            }}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ajustar Tarifa o Datos del Cliente</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
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
  defaultDate = '2026-11-01',
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
  const [neighborhood, setNeighborhood] = useState('Mi Ciudad / Base Actual');
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
    setScheduledDate(defaultDate || '2026-11-01');
    setScheduledTime(defaultTime || '08:30');
  }, [defaultDate, defaultTime, isOpen]);

  useEffect(() => {
    if (editingClient) {
      setClientName(editingClient.clientName);
      setPhone(editingClient.phone);
      setAddress(editingClient.address);
      if (NEIGHBORHOOD_COORDINATES[editingClient.neighborhood]) {
        setNeighborhood(editingClient.neighborhood);
        setCustomTown('');
      } else {
        setNeighborhood('Otra Localidad / Barrio');
        setCustomTown(editingClient.neighborhood);
      }
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
      setNeighborhood(
        prefillData.neighborhood || 'Mi Ciudad / Base Actual'
      );
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
      setNeighborhood('Mi Ciudad / Base Actual');
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
  }, [editingClient, prefillData, isOpen]);

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
      neighborhood === 'Mi Ciudad / Base Actual'
        ? `${baseLocation.city} - Centro`
        : neighborhood === 'Otra Localidad / Barrio' && customTown.trim()
        ? customTown.trim()
        : neighborhood;

    // Take coordinates dynamically from active baseLocation if in same city or custom, else preset
    const baseCoords =
      NEIGHBORHOOD_COORDINATES[finalNeighborhood] || baseLocation.coordinates;
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
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
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
                  className="w-full flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <VoiceDictationButton
                  fieldLabel="el nombre del cliente"
                  onTranscript={(txt) => {
                    setClientName(txt);
                    setErrorMsg('');
                  }}
                  quickOptions={[
                    { emoji: '🏠', label: 'Vecino Casa Nueva', value: 'Vecino Casa Nueva' },
                    { emoji: '🌳', label: 'Dueño de Quinta', value: 'Dueño de Quinta' },
                    { emoji: '🌾', label: 'Dueño de Lote / Terreno', value: 'Dueño de Lote' },
                  ]}
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <StreetAddressAutocomplete
                id="client-address-input"
                value={address}
                activeCity={baseLocation.city}
                existingProperties={existingProperties}
                onChange={(val) => {
                  setAddress(val);
                  setErrorMsg('');
                }}
                onSelectSuggestion={(sug) => {
                  setAddress(sug.streetAddress);
                  setSelectedCoordinates(sug.coordinates);
                  if (NEIGHBORHOOD_COORDINATES[sug.neighborhood]) {
                    setNeighborhood(sug.neighborhood);
                    setCustomTown('');
                  } else {
                    setNeighborhood('Otra Localidad / Barrio');
                    setCustomTown(sug.neighborhood);
                  }
                  setErrorMsg('');
                }}
              />
            </div>

            <div>
              <label
                htmlFor="client-neighborhood-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ciudad / Barrio (Dinámico según tu Base)
              </label>
              <select
                id="client-neighborhood-select"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Mi Ciudad / Base Actual">
                  📍 En mi ciudad actual ({baseLocation.city})
                </option>
                {Object.keys(NEIGHBORHOOD_COORDINATES).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
                <option value="Otra Localidad / Barrio">
                  Escribir otro barrio o localidad...
                </option>
              </select>
            </div>
          </div>

          {neighborhood === 'Otra Localidad / Barrio' && (
            <div>
              <label
                htmlFor="custom-town-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Especificar Ciudad, Pueblo o Barrio
              </label>
              <input
                id="custom-town-input"
                type="text"
                placeholder={`Ej. ${baseLocation.city} - Barrio Norte, Teodelina, Chovet...`}
                value={customTown}
                onChange={(e) => setCustomTown(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          )}

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

          <div>
            <label
              htmlFor="access-notes-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              🔑 Notas de Acceso / Portón / Mascotas (Podés hablar o elegir un dibujo)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="access-notes-input"
                type="text"
                placeholder="Ej. Candado clave 1234, perro en patio trasero, tranquera blanca"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                className="w-full flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <VoiceDictationButton
                fieldLabel="cómo entrar al lote"
                onTranscript={(txt) => setAccessNotes(txt)}
                quickOptions={[
                  { emoji: '🔑', label: 'Portón abierto sin llave', value: 'Portón abierto sin llave' },
                  { emoji: '🐕', label: 'Cuidado: hay perro en el patio', value: 'Cuidado: hay perro en el patio' },
                  { emoji: '🔔', label: 'Tocar timbre o golpear manos', value: 'Tocar timbre o golpear manos al llegar' },
                  { emoji: '🚜', label: 'Entrada ancha para tractor / carro', value: 'Entrada lateral ancha para las máquinas' },
                ]}
              />
            </div>
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
    setScheduledDate(defaultDate || '2026-11-01');
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
    const safeCity = (city || '').trim() || 'Venado Tuerto';
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

          {/* Opción 2: Elegir Ciudad / Pueblo Rápido */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ciudades y Pueblos Frecuentes (1 clic):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CITY_PRESETS).map((presetCity) => (
                <button
                  key={presetCity}
                  type="button"
                  onClick={() => handleSelectPreset(presetCity)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                    city === presetCity
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {presetCity}
                </button>
              ))}
            </div>
          </div>

          {/* Opción 3: Formulario Manual de Ciudad, Barrio o Calle */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="base-city-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Ciudad o Pueblo Base
                </label>
                <input
                  id="base-city-input"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej. Venado Tuerto, Firmat, Córdoba..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <StreetAddressAutocomplete
                  id="base-address-input"
                  label="Dirección / Calle / Punto de Salida"
                  placeholder="Ej. Bv. 25 de Mayo 850 o Estación YPF Ruta 8"
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

  useEffect(() => {
    setPrintNotice(false);
    setCopied(false);
  }, [invoice]);

  if (!invoice) return null;

  const brandName = businessProfile?.appName || 'PastoPro';
  const brandSlogan =
    businessProfile?.slogan || 'Mantenimiento de Parques, Quintas y Lotes';
  const ownerPhone = businessProfile?.ownerPhone || '';
  const aliasText = paymentProfile?.alias || 'pastopro.venado';
  const holderText =
    businessProfile?.ownerName ||
    paymentProfile?.holderName ||
    'Diego Hernández';
  const bankText = paymentProfile?.bankName || 'Banco Santa Fe / MercadoPago';

  const whatsappText = `Hola ${invoice.clientName}, te envío el comprobante ${invoice.invoiceNumber} de ${brandName} por el servicio de corte y mantenimiento en ${invoice.address} (${invoice.areaSqm} m²).
• Total: $${invoice.amount.toLocaleString('es-AR')} (${invoice.status})
• Alias para transferencia: ${aliasText} (Titular: ${holderText} - ${bankText})
• Próxima visita estimada: ${invoice.nextScheduledDate}.
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

  const handlePrintAndDownloadReceipt = () => {
    downloadReceiptAsPng(invoice, paymentProfile, businessProfile);
    setPrintNotice(true);
    setTimeout(() => setPrintNotice(false), 5000);
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
                {brandName.toUpperCase()} · {invoice.invoiceNumber}
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
            <SpeakButton
              text={buildReceiptSpeech(invoice)}
              label="🔊 Escuchar Recibo"
            />
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
          {printNotice && (
            <div className="no-print p-3 bg-emerald-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>
                ¡Comprobante {invoice.invoiceNumber}.png descargado y listo para
                imprimir o enviar!
              </span>
            </div>
          )}

          {invoice.photoUrl && (
            <div className="rounded-xl overflow-hidden border border-emerald-200 bg-slate-50">
              <img
                src={invoice.photoUrl}
                alt={`Evidencia de corte en ${invoice.address}`}
                className="w-full h-36 object-cover"
              />
              <div className="px-3 py-1.5 bg-[#0F291E] text-emerald-200 text-[11px] font-mono flex items-center justify-between">
                <span>EVIDENCIA DE LOTE TERMINADO</span>
                <span>{invoice.date}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-600">
            <span>Fecha de realización:</span>
            <span className="font-mono font-medium text-slate-900">
              {invoice.date}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Propiedad / Lote:</span>
            <span className="font-medium text-slate-900">
              {invoice.address} ({invoice.propertyType} · {invoice.areaSqm} m²)
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Estado de pago:</span>
            <span className="font-semibold text-slate-900">
              {invoice.status}
              {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ''}
            </span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Próximo corte programado:</span>
            <span className="font-mono font-medium text-slate-900">
              {invoice.nextScheduledDate}
            </span>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              Tareas ejecutadas:
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              {invoice.tasksCompleted.map((task, idx) => (
                <li key={idx}>• {task}</li>
              ))}
            </ul>
          </div>

          {/* Datos Bancarios / Alias para Transferencia */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-emerald-950 flex items-center justify-between">
              <span>Datos para Transferencia / MercadoPago</span>
              <span className="font-mono text-emerald-800">{aliasText}</span>
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              Titular: {holderText} · {bankText}
              {paymentProfile?.cbu ? ` · CBU: ${paymentProfile.cbu}` : ''}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              Total Servicio
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              ${invoice.amount.toLocaleString('es-AR')}
            </span>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintAndDownloadReceipt}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700" />
              <span>{printNotice ? '¡Descargado!' : 'Imprimir / Descargar'}</span>
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
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
                🌿 Elegir Tareas con Dibujos (Tocá para sumar o quitar sin escribir):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                {VISUAL_TASK_PRESETS.map((preset) => {
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
                          speakTextInSpanish(`Quitado: ${preset.shortTitle}`);
                        } else {
                          const updated = [...currentList, preset.taskText];
                          setTasksText(updated.join(', '));
                          speakTextInSpanish(preset.spokenText);
                        }
                      }}
                      className={`min-h-[44px] p-2 rounded-xl border text-left flex items-center gap-2 text-xs font-extrabold transition-all ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-900 shadow-2xs'
                          : `${preset.colorClass} hover:opacity-90`
                      }`}
                    >
                      <span className="text-lg shrink-0">{preset.emoji}</span>
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
                🔑 Nota de Acceso / Portón (Podés hablar o elegir dibujo)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="edit-job-notes-input"
                  type="text"
                  value={accessNotes}
                  onChange={(e) => setAccessNotes(e.target.value)}
                  className="w-full flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
                <VoiceDictationButton
                  fieldLabel="la nota de acceso"
                  onTranscript={(txt) => setAccessNotes(txt)}
                  quickOptions={[
                    { emoji: '🔑', label: 'Portón sin llave', value: 'Portón abierto sin llave' },
                    { emoji: '🐕', label: 'Cuidado con el perro', value: 'Cuidado: hay perro en el patio' },
                    { emoji: '🔔', label: 'Tocar timbre fuerte', value: 'Tocar timbre fuerte al llegar' },
                  ]}
                />
              </div>
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
      alias: alias.trim() || 'pastopro.venado',
      cbu: cbu.trim(),
      holderName: holderName.trim() || 'Diego Hernández',
      bankName: bankName.trim() || 'Banco Santa Fe / MercadoPago',
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
                placeholder="Ej. pastopro.venado"
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
                placeholder="Ej. Diego Hernández"
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
                placeholder="Ej. Banco Santa Fe / MercadoPago"
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
      setNeighborhood(invoice.neighborhood || 'Venado Tuerto');
      setDate(invoice.date);
      setAmount(String(invoice.amount));
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
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-invoice-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl my-6 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div>
            <div className="text-[11px] font-mono font-bold text-emerald-800">
              EDITAR COMPROBANTE EMITIDO · {invoice.invoiceNumber}
            </div>
            <h2
              id="edit-invoice-modal-title"
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              Corregir Datos del Recibo y Cobro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición de recibo"
            className="min-h-[42px] min-w-[42px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                Monto Cobrado / Facturado ($)
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
            <span>
              Actualizar también la tarifa habitual en la ficha de este cliente
            </span>
          </label>

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
    const cleanAppName = appName.trim() || 'PastoPro';
    const cleanOwner = ownerName.trim() || 'Diego Hernández';
    onSaveBusinessAndPayment(
      {
        appName: cleanAppName,
        slogan:
          slogan.trim() || 'Mantenimiento de Parques, Quintas y Terrenos',
        ownerName: cleanOwner,
        ownerPhone: ownerPhone.trim() || '3462-558899',
        baseRatePerSqm: Math.max(15, Number(baseRatePerSqm) || 65),
        minServicePrice: Math.max(3000, Number(minServicePrice) || 18000),
      },
      {
        alias: alias.trim() || 'pastopro.venado',
        holderName: cleanOwner,
        bankName: bankName.trim() || 'Banco Santa Fe / MercadoPago',
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
              <div className="flex items-center gap-2">
                <input
                  id="business-app-name-input"
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Ej. Cortes El Trébol, Jardinería Hernández..."
                  className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <VoiceDictationButton
                  fieldLabel="el nombre de tu emprendimiento"
                  onTranscript={(txt) => setAppName(txt)}
                />
              </div>
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
                placeholder="Ej. Diego Hernández"
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

