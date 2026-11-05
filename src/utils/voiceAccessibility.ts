import { ClientProperty, ScheduledJob } from '../types/lawn';

/**
 * Pure helper to build a clear, natural-language Spanish audio guide for a single work order
 * designed for field operators who prefer auditory guidance or cannot read/write.
 */
export function buildSpokenJobSummary(job: ScheduledJob): string {
  const statusPhrase =
    job.status === 'Completado'
      ? 'Este trabajo ya está terminado.'
      : job.status === 'En Curso'
      ? 'Este trabajo está en curso ahora mismo.'
      : 'Este trabajo está pendiente por hacer.';

  const timeFormatted = (job.scheduledTime || '08:00').replace(':', ' y ');
  const priceThousands = Math.round(job.price / 1000);
  const pricePhrase =
    priceThousands > 0 && job.price % 1000 === 0
      ? `${priceThousands} mil pesos`
      : `${job.price.toLocaleString('es-AR')} pesos`;

  return `Parada número ${job.orderIndex}. Cliente: ${job.clientName}. Dirección: ${job.address}, en zona ${job.neighborhood}. Horario: ${timeFormatted} horas. Superficie: ${job.areaSqm} metros cuadrados. Valor a cobrar: ${pricePhrase}. ${statusPhrase} Tocá el botón azul para abrir el mapa GPS, el botón amarillo para iniciar el reloj, o el botón verde para terminar y cobrar.`;
}

export interface RouteBriefingParams {
  dateStr: string;
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  expectedRevenue: number;
  nextJob: ScheduledJob | null;
}

/**
 * Pure helper to build a spoken summary of the entire day's route.
 */
export function buildSpokenRouteBriefing(params: RouteBriefingParams): string {
  const {
    totalJobs,
    completedJobs,
    pendingJobs,
    expectedRevenue,
    nextJob,
  } = params;

  if (totalJobs === 0) {
    return 'Hola. Hoy no tenés trabajos programados en la lista. Tocá el botón azul de agendar corte para sumar un trabajo hoy.';
  }

  const nextJobPhrase = nextJob
    ? `Tu próxima parada es la número ${nextJob.orderIndex}, de ${nextJob.clientName}, en la dirección ${nextJob.address}, por ${nextJob.price.toLocaleString('es-AR')} pesos.`
    : '¡Felicitaciones! Ya terminaste todas las paradas del día.';

  return `Resumen de tu ruta del día. Tenés ${totalJobs} trabajos programados en total: ${completedJobs} terminados. Faltan ${pendingJobs} por hacer. El total del día suma ${expectedRevenue.toLocaleString('es-AR')} pesos. ${nextJobPhrase}`;
}

export interface FinanceBriefingParams {
  periodLabel: string;
  totalCobrado: number;
  totalGastos: number;
  gananciaNeta: number;
  porCobrar: number;
}

/**
 * Pure helper to build a spoken summary of the financial balance (Mi Plata y Caja).
 */
export function buildSpokenFinanceSummary(params: FinanceBriefingParams): string {
  const {
    periodLabel,
    totalCobrado,
    totalGastos,
    gananciaNeta,
    porCobrar,
  } = params;

  return `Resumen de tu plata en el período ${periodLabel}. Tu ganancia limpia en mano es de ${gananciaNeta.toLocaleString('es-AR')} pesos. Cobraste en total ${totalCobrado.toLocaleString('es-AR')} pesos, gastaste ${totalGastos.toLocaleString('es-AR')} pesos en insumos o combustible. Pendiente por cobrar en la calle: ${porCobrar.toLocaleString('es-AR')} pesos.`;
}

/**
 * Pure helper to build a spoken summary of a client property card.
 */
export function buildSpokenClientSummary(
  client: ClientProperty,
  pendingBalance = 0
): string {
  const debtPhrase =
    pendingBalance > 0
      ? ` Tiene una deuda pendiente de ${pendingBalance.toLocaleString('es-AR')} pesos.`
      : ' Está al día sin deudas.';

  return `Cliente: ${client.clientName}. Dirección: ${client.address}, en ${client.neighborhood}. Es una propiedad tipo ${client.propertyType} de ${client.areaSqm} metros cuadrados. Frecuencia ${client.frequency}. El precio actual es de ${client.basePrice.toLocaleString('es-AR')} pesos.${debtPhrase}`;
}

/**
 * Speaks the given text aloud in Spanish using the browser's Web Speech API.
 * Safe no-op in headless/non-browser environments.
 */
export function speakTextAloud(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR';
    utterance.rate = 0.96;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang.toLowerCase().includes('es-ar')) ||
      voices.find((v) => v.lang.toLowerCase().includes('es-419')) ||
      voices.find((v) => v.lang.toLowerCase().includes('es-mx')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('es'));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }
}

export function stopSpeakingAloud(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

