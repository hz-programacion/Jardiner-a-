import { ClientProperty, InvoiceRecord, ScheduledJob } from '../types/lawn';

export interface AccessibilitySettings {
  easyMode: boolean; // Simplifies UI with giant visual cards, step-by-step assistant, and pictograms
  autoReadOnTap: boolean; // Automatically reads out loud when selecting a job, tab, or action
  fontScale: 'normal' | 'large' | 'xlarge'; // 100%, 112%, 125%
  highContrastSun: boolean; // Extra bold borders and high contrast for bright outdoor sun
  speechRate: number; // 0.85 (slow/clear), 1.0 (normal), 1.15 (fast)
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  easyMode: false,
  autoReadOnTap: false,
  fontScale: 'normal',
  highContrastSun: false,
  speechRate: 0.95,
};

export interface VisualTaskPreset {
  id: string;
  emoji: string;
  shortTitle: string;
  taskText: string;
  spokenText: string;
  colorClass: string;
}

export const VISUAL_TASK_PRESETS: VisualTaskPreset[] = [
  {
    id: 'corte-general',
    emoji: '🚜',
    shortTitle: 'Cortar Pasto',
    taskText: 'Corte general de pasto',
    spokenText: 'Cortar el pasto general del terreno',
    colorClass: 'bg-emerald-50 border-emerald-400 text-emerald-950',
  },
  {
    id: 'bordeado',
    emoji: '🌿',
    shortTitle: 'Bordear Orillas',
    taskText: 'Bordeado con motoguadaña en bordes y vereda',
    spokenText: 'Bordear las orillas, tapiales y vereda con motoguadaña',
    colorClass: 'bg-teal-50 border-teal-400 text-teal-950',
  },
  {
    id: 'soplado-barrido',
    emoji: '🍂',
    shortTitle: 'Barrer / Soplar',
    taskText: 'Soplado y barrido de vereda y galería',
    spokenText: 'Barrer y soplar el pasto cortado y las hojas de la vereda',
    colorClass: 'bg-amber-50 border-amber-400 text-amber-950',
  },
  {
    id: 'bolsas-recoleccion',
    emoji: '🛍️',
    shortTitle: 'Embolsar Pasto',
    taskText: 'Recolección y embolsado de pasto cortado',
    spokenText: 'Juntar y embolsar todo el pasto cortado',
    colorClass: 'bg-blue-50 border-blue-400 text-blue-950',
  },
  {
    id: 'desmalezado-alto',
    emoji: '🌾',
    shortTitle: 'Yuyo Alto',
    taskText: 'Desmalezado pesado de pastizal alto con cuchilla',
    spokenText: 'Desmalezar pasto o yuyo alto pesado',
    colorClass: 'bg-orange-50 border-orange-400 text-orange-950',
  },
  {
    id: 'cerco-poda',
    emoji: '✂️',
    shortTitle: 'Podar Cerco',
    taskText: 'Recorte y emprolijado de cerco vivo',
    spokenText: 'Podar y emprolijar el cerco vivo o plantas',
    colorClass: 'bg-lime-50 border-lime-400 text-lime-950',
  },
];

export interface VisualExpensePreset {
  id: string;
  emoji: string;
  label: string;
  category:
    | 'Combustible y Aceite 2T'
    | 'Tanza y Cuchillas'
    | 'Mantenimiento Equipos'
    | 'Traslado / Peajes'
    | 'Ayudante / Jornal';
  description: string;
  defaultAmount: number;
  spokenText: string;
}

export const VISUAL_EXPENSE_PRESETS: VisualExpensePreset[] = [
  {
    id: 'nafta',
    emoji: '⛽',
    label: 'Nafta y Aceite',
    category: 'Combustible y Aceite 2T',
    description: 'Carga de Nafta Súper y Aceite 2T',
    defaultAmount: 15000,
    spokenText: 'Gasto de Nafta y Aceite para las máquinas, quince mil pesos',
  },
  {
    id: 'tanza',
    emoji: '🧵',
    label: 'Rollo de Tanza',
    category: 'Tanza y Cuchillas',
    description: 'Compra de tanza para motoguadaña / afilado cuchilla',
    defaultAmount: 12000,
    spokenText: 'Gasto de Tanza o Cuchilla, doce mil pesos',
  },
  {
    id: 'ayudante',
    emoji: '👷',
    label: 'Pago Ayudante',
    category: 'Ayudante / Jornal',
    description: 'Pago del día al ayudante',
    defaultAmount: 25000,
    spokenText: 'Pago del jornal al ayudante, veinticinco mil pesos',
  },
  {
    id: 'camioneta',
    emoji: '🛻',
    label: 'Gasoil / Viaje',
    category: 'Traslado / Peajes',
    description: 'Combustible camioneta para ruta y pueblos',
    defaultAmount: 18000,
    spokenText: 'Combustible de la camioneta para viajar, dieciocho mil pesos',
  },
  {
    id: 'repuesto',
    emoji: '🔧',
    label: 'Taller / Bujía',
    category: 'Mantenimiento Equipos',
    description: 'Arreglo de máquina, bujía o filtro',
    defaultAmount: 16000,
    spokenText: 'Arreglo de máquina o repuesto en el taller, dieciséis mil pesos',
  },
];

/**
 * Formats currency into natural spoken Argentine Spanish words/numbers
 * so TTS engines don't read "$38.000" as "treinta y ocho punto cero cero cero".
 */
export function formatSpokenPesos(amount: number): string {
  const clean = Math.round(Math.abs(amount));
  if (clean === 0) return 'cero pesos';
  if (clean % 1000 === 0) {
    const thousands = clean / 1000;
    return `${thousands} mil pesos`;
  }
  return `${clean} pesos`;
}

/**
 * Formats "08:30" into natural spoken time: "8 y 30 de la mañana"
 */
export function formatSpokenTime(timeStr: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!match) return timeStr || 'horario a confirmar';
  const hour24 = Number(match[1]);
  const minutes = Number(match[2]);
  const period =
    hour24 < 12 ? 'de la mañana' : hour24 < 20 ? 'de la tarde' : 'de la noche';
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24;
  if (minutes === 0) {
    return `${hour12} en punto ${period}`;
  }
  return `${hour12} y ${minutes} ${period}`;
}

/**
 * Builds a clear, friendly spoken summary for a single scheduled job card
 * tailored for someone who cannot read the screen.
 */
export function buildJobCardSpeech(
  job: ScheduledJob,
  stopNumber?: number
): string {
  const stopPrefix =
    typeof stopNumber === 'number' ? `Parada número ${stopNumber}. ` : '';
  const statusText =
    job.status === 'Completado'
      ? 'Este trabajo ya está terminado.'
      : job.status === 'En Curso'
      ? 'Este trabajo está en curso ahora mismo.'
      : 'Trabajo pendiente por hacer.';

  const timeText = `Horario: ${formatSpokenTime(job.scheduledTime)}.`;
  const clientAndAddress = `Cliente: ${job.clientName}. Dirección: ${job.address}, en ${job.neighborhood}.`;
  const tasksText =
    job.tasks && job.tasks.length > 0
      ? `Qué hay que hacer: ${job.tasks.join(', ')}.`
      : 'Tarea: corte de pasto general.';
  const accessText = job.accessNotes
    ? `Cómo entrar al lote: ${job.accessNotes}.`
    : '';
  const priceText = `Precio a cobrar: ${formatSpokenPesos(job.price)}.`;

  return [
    stopPrefix,
    statusText,
    clientAndAddress,
    timeText,
    tasksText,
    accessText,
    priceText,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Builds a spoken overview of the entire day's route so the worker knows
 * how many jobs they have, what is next, and how much money they will make today.
 */
export function buildDailySummarySpeech(
  jobs: ScheduledJob[],
  cityLabel: string
): string {
  if (jobs.length === 0) {
    return `Hoy no tenés ningún corte anotado en la ruta saliendo desde ${cityLabel}. Podés tocar el botón verde de arriba para agregar un corte nuevo.`;
  }

  const completed = jobs.filter((j) => j.status === 'Completado');
  const pending = jobs.filter((j) => j.status !== 'Completado');
  const totalMoney = jobs.reduce((acc, j) => acc + j.price, 0);

  const nextJob = pending[0];
  const nextJobSentence = nextJob
    ? `Tu próximo trabajo es en lo de ${nextJob.clientName}, en la calle ${nextJob.address}, a las ${formatSpokenTime(
        nextJob.scheduledTime
      )}, para cobrar ${formatSpokenPesos(nextJob.price)}.`
    : '¡Felicitaciones! Ya terminaste todos los cortes del día.';

  return `Resumen de tu ruta de hoy desde ${cityLabel}. Tenés ${
    jobs.length
  } ${jobs.length === 1 ? 'corte anotado' : 'cortes anotados'} por un total de ${formatSpokenPesos(
    totalMoney
  )}. Ya terminaste ${completed.length} y te quedan ${
    pending.length
  } por hacer. ${nextJobSentence}`;
}

/**
 * Builds a spoken description of a client card in the directory
 */
export function buildClientSpeech(
  client: ClientProperty,
  pendingDebt = 0
): string {
  const debtSentence =
    pendingDebt > 0
      ? `Atención: este cliente tiene una deuda sin pagar de ${formatSpokenPesos(
          pendingDebt
        )}.`
      : 'Está al día con los pagos.';

  return `Cliente ${client.clientName}. Dirección: ${client.address}, en ${
    client.neighborhood
  }. Tarifa actual: ${formatSpokenPesos(
    client.basePrice
  )} cada corte. ${debtSentence} Cómo entrar: ${
    client.accessNotes || 'sin indicaciones especiales'
  }.`;
}

/**
 * Builds a spoken summary of the worker's money/finances
 */
export function buildFinanceSummarySpeech(params: {
  collected: number;
  expenses: number;
  netProfit: number;
  pendingDebt: number;
  completedCount: number;
}): string {
  return `Resumen de tu plata. Hiciste ${
    params.completedCount
  } cortes cobrados. Te entraron ${formatSpokenPesos(
    params.collected
  )}. Gastaste en nafta e insumos ${formatSpokenPesos(
    params.expenses
  )}. Te quedan limpios en el bolsillo ${formatSpokenPesos(
    params.netProfit
  )}. Además, tenés ${formatSpokenPesos(
    params.pendingDebt
  )} pendientes por cobrar de clientes que quedaron debiendo.`;
}

/**
 * Builds a spoken receipt summary
 */
export function buildReceiptSpeech(invoice: InvoiceRecord): string {
  const paidText =
    invoice.status === 'Pagado'
      ? `Ya está pagado por ${invoice.paymentMethod}.`
      : 'Quedó pendiente de cobro.';
  return `Recibo de ${invoice.clientName}, en ${
    invoice.address
  }. Monto: ${formatSpokenPesos(invoice.amount)}. ${paidText}`;
}

/**
 * Browser Web Speech API wrapper (Text-to-Speech)
 */
export function speakTextInSpanish(
  text: string,
  rate = 0.95,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR';
    utterance.rate = Math.max(0.75, Math.min(1.25, rate));
    utterance.pitch = 1.0;

    // Pick best Spanish voice if available
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang.toLowerCase().includes('es-ar')) ||
      voices.find((v) => v.lang.toLowerCase().includes('es-419')) ||
      voices.find((v) => v.lang.toLowerCase().includes('es-es')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('es'));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onEnd?.();
    return false;
  }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Browser SpeechRecognition wrapper (Speech-to-Text voice dictation)
 */
export function isVoiceDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function startSpanishVoiceDictation(callbacks: {
  onResult: (transcript: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}): (() => void) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };
  const SpeechRecognitionCtor =
    win.SpeechRecognition || win.webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    callbacks.onError?.(
      'Este navegador no tiene micrófono de dictado directo activado.'
    );
    callbacks.onEnd?.();
    return null;
  }

  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript;
      if (transcript) {
        callbacks.onResult(String(transcript).trim());
      }
    };

    recognition.onerror = () => {
      callbacks.onError?.(
        'No se pudo escuchar el micrófono. Revisá el permiso del micrófono o usá las opciones rápidas con dibujos.'
      );
      callbacks.onEnd?.();
    };

    recognition.onend = () => {
      callbacks.onEnd?.();
    };

    recognition.start();
    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  } catch {
    callbacks.onError?.('No se pudo iniciar el micrófono.');
    callbacks.onEnd?.();
    return null;
  }
}
