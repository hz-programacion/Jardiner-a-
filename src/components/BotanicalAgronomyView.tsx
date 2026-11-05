import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Leaf,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Sun,
} from 'lucide-react';
import { ClientProperty, ScheduledJob } from '../types/lawn';

export interface GrassSpeciesGuide {
  id: 'gramillon' | 'bermuda' | 'kikuyo' | 'festuca';
  name: string;
  scientificName: string;
  commonRegions: string;
  idealCutHeightSummerCm: string;
  idealCutHeightWinterCm: string;
  recommendedFrequency: string;
  sunRequirement: string;
  bladeAdvice: string;
  seasonalTip: string;
  recommendedTaskLabel: string;
}

export const ARGENTINA_GRASS_SPECIES: GrassSpeciesGuide[] = [
  {
    id: 'gramillon',
    name: 'Gramillón (San Agustín)',
    scientificName: 'Stenotaphrum secundatum',
    commonRegions: 'Región Pampeana, Litoral, GBA y Quintas',
    idealCutHeightSummerCm: '4.5 a 6 cm',
    idealCutHeightWinterCm: '6 a 7 cm',
    recommendedFrequency: 'Quincenal (Semanal en diciembre-febrero)',
    sunRequirement: 'Sol pleno o media sombra bajo arboledas',
    bladeAdvice:
      'Hoja ancha y estolones gruesos. Requiere cuchilla bien afilada a altas RPM para no deshilachar la punta de la hoja.',
    seasonalTip:
      'Nunca cortar más de un tercio del alto de la hoja de una sola vez: si se pela al ras en verano, el sol quema el estolón y amarillea.',
    recommendedTaskLabel:
      'Corte de Gramillón a 5 cm + Bordeado perimetral sin pelar estolones',
  },
  {
    id: 'bermuda',
    name: 'Bermuda / Gramilla Fina (Tifway)',
    scientificName: 'Cynodon dactylon',
    commonRegions: 'Casas residenciales, barrios privados y campos deportivos',
    idealCutHeightSummerCm: '2.5 a 4 cm',
    idealCutHeightWinterCm: '4 a 5 cm (Entra en dormancia con heladas)',
    recommendedFrequency: 'Semanal en primavera-verano',
    sunRequirement: 'Sol directo pleno (no tolera sombra densa)',
    bladeAdvice:
      'Textura fina y alta densidad. Ideal para corte bajo en franjas cruzadas con autopropulsada o tractor.',
    seasonalTip:
      'En otoño conviene realizar resiembra con Rye Grass anual para mantener el color verde durante los meses de heladas.',
    recommendedTaskLabel:
      'Corte bajo de Bermuda a 3.5 cm + Perfilado de bordes y barrido fino',
  },
  {
    id: 'kikuyo',
    name: 'Kikuyo',
    scientificName: 'Pennisetum clandestinum',
    commonRegions: 'Centro del país, Córdoba, Santa Fe y parques de alto tránsito',
    idealCutHeightSummerCm: '3.5 a 5 cm',
    idealCutHeightWinterCm: '5 cm',
    recommendedFrequency: 'Cada 7 a 10 días en temporada cálida',
    sunRequirement: 'Sol pleno y suelos fértiles',
    bladeAdvice:
      'Crecimiento sumamente agresivo y colchón esponjoso. Evitar que supere los 10 cm porque acumula fieltro seco ("thatch") abajo.',
    seasonalTip:
      'Controlar periódicamente los bordes de canteros y veredas con bordeadora porque sus rizomas invaden rápido los ladrillos y cercos.',
    recommendedTaskLabel:
      'Corte controlado de Kikuyo a 4 cm + Desborde profundo de canteros y vereda',
  },
  {
    id: 'festuca',
    name: 'Festuca Alta / Rye Grass (Mezcla Todo el Año)',
    scientificName: 'Festuca arundinacea · Lolium perenne',
    commonRegions: 'Parques sombreados, zonas templadas-frías y resiembras de otoño',
    idealCutHeightSummerCm: '6 a 7.5 cm',
    idealCutHeightWinterCm: '5 a 6 cm',
    recommendedFrequency: 'Quincenal (Activo también en otoño e invierno)',
    sunRequirement: 'Excelente adaptación a media sombra y frío',
    bladeAdvice:
      'Crece en matas verticales sin estolones rastreros. Mantener corte alto en verano para proteger la raíz del calor.',
    seasonalTip:
      'En días de más de 32°C subir un punto la altura de las ruedas de la cortadora para conservar la humedad del suelo.',
    recommendedTaskLabel:
      'Corte alto de Festuca/Rye Grass a 6.5 cm + Soplado de hojas secas',
  },
];

export interface SeasonalServicePackage {
  id: string;
  title: string;
  season: string;
  description: string;
  suggestedExtraArs: number;
  taskLine: string;
}

export const SEASONAL_UPSELL_PACKAGES: SeasonalServicePackage[] = [
  {
    id: 'poda-cerco',
    title: 'Recorte y Escuadrado de Cerco Vivo',
    season: 'Primavera · Verano',
    description:
      'Perfilado recto superior y lateral de ligustrina, crataegus, laurel o tuyas con cortacerco y recolección de ramas.',
    suggestedExtraArs: 18000,
    taskLine: 'Poda y perfilado de cerco vivo perimetral + retiro de ramas',
  },
  {
    id: 'limpieza-canteros',
    title: 'Carpido de Canteros y Tazas de Árboles',
    season: 'Todo el año',
    description:
      'Desmalezado manual de canteros florales, demarcación circular de tazas en árboles para proteger cortezas de la tanza.',
    suggestedExtraArs: 12000,
    taskLine: 'Desmalezado de canteros y demarcación de tazas en árboles',
  },
  {
    id: 'fertilizacion-primavera',
    title: 'Fertilización Granulada Verde Intenso',
    season: 'Primavera · Otoño',
    description:
      'Aplicación uniforme de fertilizante nitrogenado / triple 15 post-corte para acelerar el rebrote y cubrir manchones.',
    suggestedExtraArs: 22000,
    taskLine: 'Aplicación de fertilizante granulado de liberación gradual',
  },
  {
    id: 'desmalezado-pesado',
    title: 'Recuperación de Lote con Maleza Alta',
    season: 'Temporada de lluvias',
    description:
      'Desbaste inicial con cuchilla de 3 puntas o tanza cuadrada gruesa, segundo pase de emparejado y despeje de cordón cuneta.',
    suggestedExtraArs: 25000,
    taskLine: 'Desmalezado intensivo en doble pasada + despeje de vereda',
  },
];

interface ChecklistItem {
  id: string;
  category: 'Seguridad' | 'Corte' | 'Terminación';
  label: string;
  checked: boolean;
}

const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: 'chk-1',
    category: 'Seguridad',
    label: 'Protector ocular / facial, calzado cerrado y protección auditiva en camioneta',
    checked: true,
  },
  {
    id: 'chk-2',
    category: 'Corte',
    label: 'Cuchilla de cortadora afilada y carretel de tanza recargado',
    checked: true,
  },
  {
    id: 'chk-3',
    category: 'Corte',
    label: 'Combustible verificado y filtro de aire limpio para la jornada',
    checked: true,
  },
  {
    id: 'chk-4',
    category: 'Terminación',
    label: 'Sopladora, rastrillo barrehojas, escobillón y bolsas de consorcio resistentes',
    checked: false,
  },
  {
    id: 'chk-5',
    category: 'Terminación',
    label: 'Teléfono con batería para fotos Antes/Después y envío de recibos PDF',
    checked: true,
  },
];

const CHECKLIST_STORAGE_KEY = 'pastopro_field_checklist_v1';

interface BotanicalAgronomyViewProps {
  activeDate: string;
  todayJobs: ScheduledJob[];
  properties: ClientProperty[];
  onAddTaskToJob: (
    jobId: string,
    taskText: string,
    extraAmountArs: number
  ) => void;
  onNavigateToRoute: () => void;
}

export function BotanicalAgronomyView({
  activeDate,
  todayJobs,
  properties,
  onAddTaskToJob,
  onNavigateToRoute,
}: BotanicalAgronomyViewProps) {
  const [selectedSpeciesId, setSelectedSpeciesId] =
    useState<GrassSpeciesGuide['id']>('gramillon');
  const [selectedTargetJobId, setSelectedTargetJobId] = useState<string>(
    () => todayJobs.find((j) => j.status !== 'Completado')?.id || todayJobs[0]?.id || ''
  );
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CHECKLIST;
  });

  const activeSpecies = useMemo(
    () =>
      ARGENTINA_GRASS_SPECIES.find((s) => s.id === selectedSpeciesId) ||
      ARGENTINA_GRASS_SPECIES[0],
    [selectedSpeciesId]
  );

  const pendingOrActiveJobs = useMemo(
    () => todayJobs.filter((j) => j.status !== 'Completado'),
    [todayJobs]
  );

  const effectiveJobId =
    selectedTargetJobId && todayJobs.some((j) => j.id === selectedTargetJobId)
      ? selectedTargetJobId
      : pendingOrActiveJobs[0]?.id || todayJobs[0]?.id || '';

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      );
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetChecklist = () => {
    const allChecked = INITIAL_CHECKLIST.map((i) => ({ ...i, checked: true }));
    setChecklist(allChecked);
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(allChecked));
    } catch {
      // ignore
    }
    setFeedbackNotice('Lista de salida marcada al 100% para iniciar el recorrido.');
  };

  const completedChecklistCount = checklist.filter((i) => i.checked).length;
  const checklistPct = Math.round(
    (completedChecklistCount / Math.max(1, checklist.length)) * 100
  );

  const handleApplySpeciesTask = () => {
    if (!effectiveJobId) {
      setFeedbackNotice('Agendá primero una orden en el día para sumarle esta tarea.');
      return;
    }
    onAddTaskToJob(effectiveJobId, activeSpecies.recommendedTaskLabel, 0);
    const targetJob = todayJobs.find((j) => j.id === effectiveJobId);
    setFeedbackNotice(
      `Se sumó "${activeSpecies.recommendedTaskLabel}" a la orden de ${
        targetJob?.clientName || 'hoy'
      }.`
    );
  };

  const handleApplySeasonalPackage = (pkg: SeasonalServicePackage) => {
    if (!effectiveJobId) {
      setFeedbackNotice('Agendá primero una orden en el día para sumarle este adicional.');
      return;
    }
    onAddTaskToJob(effectiveJobId, pkg.taskLine, pkg.suggestedExtraArs);
    const targetJob = todayJobs.find((j) => j.id === effectiveJobId);
    setFeedbackNotice(
      `Servicio adicional "${pkg.title}" (+$${pkg.suggestedExtraArs.toLocaleString(
        'es-AR'
      )}) sumado a la orden de ${targetJob?.clientName || 'hoy'}.`
    );
  };

  return (
    <div className="space-y-6" data-testid="botanical-agronomy-view">
      {/* AGRONOMÍA Y CÉSPED DAYLIGHT HEADER */}
      <section className="bg-white text-stone-900 border border-[#E4E2DA] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.12em] font-bold text-[#23533B]">
            <Leaf className="w-4 h-4 text-[#23533B] shrink-0" />
            <span>Agronomía Práctica de Parques y Jardines</span>
            <span aria-hidden="true">·</span>
            <span>{properties.length} Lotes Registrados</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Manual de Césped, Servicios de Estación y Salida a Ruta
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Consultá la altura ideal de corte según el tipo de pasto de cada cliente, sumá servicios adicionales de poda o fertilización a tus órdenes del día y verificá tu equipo antes de salir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {todayJobs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-[#F7F6F2] border border-[#E4E2DA] rounded-xl px-3 py-2 max-w-full">
              <label
                htmlFor="agronomy-target-job-select"
                className="text-xs font-mono font-semibold text-stone-700 whitespace-nowrap"
              >
                Orden activa ({activeDate}):
              </label>
              <select
                id="agronomy-target-job-select"
                data-testid="agronomy-target-job-select"
                value={effectiveJobId}
                onChange={(e) => setSelectedTargetJobId(e.target.value)}
                className="text-xs font-semibold text-stone-900 bg-white border border-[#E4E2DA] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#23533B]/30 max-w-full"
              >
                {todayJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    #{j.orderIndex} · {j.clientName} ($
                    {j.price.toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onNavigateToRoute}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#23533B] hover:bg-[#1A3F2C] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>Ver órdenes del día</span>
          </button>
        </div>
      </section>

      {feedbackNotice && (
        <div
          role="status"
          data-testid="agronomy-action-banner"
          className="bg-[#EBF3EE] text-stone-900 border border-[#CFE0D6] px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#23533B] shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs font-semibold text-emerald-300 hover:text-white underline cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 1. ATLAS DE ESPECIES DE CÉSPED Y ALTURA DE CORTE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-stone-950">
                01. Guía de Especies de Césped y Altura de Corte
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Seleccioná la variedad del jardín para ver la regulación exacta de altura y evitar quemar el césped.
              </p>
            </div>
          </div>

          {/* Species Selector Tabs */}
          <div
            role="tablist"
            aria-label="Especies de césped"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200/80"
          >
            {ARGENTINA_GRASS_SPECIES.map((sp) => {
              const isSelected = sp.id === activeSpecies.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`species-tab-${sp.id}`}
                  onClick={() => setSelectedSpeciesId(sp.id)}
                  className={`min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate ${
                    isSelected
                      ? 'bg-white text-stone-950 shadow-2xs border border-stone-200/90'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  {sp.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Active Species Specification Sheet */}
          <div
            data-testid="active-species-detail-card"
            className="p-4 sm:p-5 rounded-xl bg-stone-50/90 border border-stone-200/90 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/80 pb-3.5">
              <div>
                <h4 className="font-display text-lg font-bold text-stone-950">
                  {activeSpecies.name}
                </h4>
                <p className="text-xs text-stone-500 italic mt-0.5">
                  {activeSpecies.scientificName} · {activeSpecies.commonRegions}
                </p>
              </div>
              <button
                type="button"
                data-testid="apply-species-task-btn"
                onClick={handleApplySpeciesTask}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Sumar especificación a la orden</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-xl border border-stone-200/80">
                <div className="text-xs text-stone-500 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Altura Primavera / Verano</span>
                </div>
                <div className="font-mono text-base font-bold text-stone-950 tabular-nums mt-1">
                  {activeSpecies.idealCutHeightSummerCm}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200/80">
                <div className="text-xs text-stone-500 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Altura Otoño / Invierno</span>
                </div>
                <div className="font-mono text-base font-bold text-stone-950 tabular-nums mt-1">
                  {activeSpecies.idealCutHeightWinterCm}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-stone-200/80">
                <div className="text-xs text-stone-500">Frecuencia Sugerida</div>
                <div className="text-xs font-semibold text-stone-900 mt-1 leading-snug">
                  {activeSpecies.recommendedFrequency}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-stone-700 leading-relaxed pt-1">
              <p>
                <strong className="text-stone-950 font-semibold">
                  Técnica de corte recomendada:
                </strong>{' '}
                {activeSpecies.bladeAdvice}
              </p>
              <p>
                <strong className="text-stone-950 font-semibold">
                  Cuidado estacional clave:
                </strong>{' '}
                {activeSpecies.seasonalTip}
              </p>
            </div>
          </div>
        </section>

        {/* 2. CHECKLIST DE SALIDA EN CAMIONETA */}
        <section
          data-testid="field-departure-checklist"
          className="lg:col-span-5 bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <h3 className="font-display text-base sm:text-lg font-bold text-stone-950">
                  02. Checklist Antes de Salir a Ruta
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Repaso rápido para no olvidar herramientas ni insumos antes de arrancar la jornada.
              </p>
            </div>

            <span className="font-mono text-xs font-bold text-emerald-800 tabular-nums shrink-0">
              {completedChecklistCount}/{checklist.length} ({checklistPct}%)
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-emerald-700 transition-all duration-200"
              style={{ width: `${checklistPct}%` }}
            />
          </div>

          <div className="divide-y divide-stone-200/80">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="py-3 flex items-start gap-3 cursor-pointer select-none group"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecklistItem(item.id)}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <span
                    className={`font-medium block leading-snug ${
                      item.checked
                        ? 'text-stone-500 line-through'
                        : 'text-stone-900 font-semibold'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {item.category}
                  </span>
                </div>
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-2">
            <span className="text-xs text-stone-500">
              {checklistPct === 100
                ? 'Equipo completo listo para salir.'
                : 'Marcá cada ítem al cargar la camioneta.'}
            </span>
            <button
              type="button"
              onClick={resetChecklist}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Marcar Todo Listo</span>
            </button>
          </div>
        </section>
      </div>

      {/* 3. CATÁLOGO DE TRABAJOS ADICIONALES DE JARDINERÍA (PARA SUMAR A ÓRDENES DEL DÍA) */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3.5">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-stone-950">
              03. Servicios Adicionales de Jardinería (Sumar a Orden Activa)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Agregá con un clic tareas de poda, canteros o fertilización a la orden seleccionada y actualizá automáticamente las tareas y el precio del servicio.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEASONAL_UPSELL_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              data-testid={`upsell-pkg-${pkg.id}`}
              className="p-4 rounded-xl bg-stone-50/80 border border-stone-200/90 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span>{pkg.season}</span>
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    +${pkg.suggestedExtraArs.toLocaleString('es-AR')}
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold text-stone-950 leading-snug">
                  {pkg.title}
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {pkg.description}
                </p>
              </div>

              <button
                type="button"
                data-testid={`add-upsell-btn-${pkg.id}`}
                onClick={() => handleApplySeasonalPackage(pkg)}
                className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-emerald-800 text-stone-900 hover:text-white border border-stone-300 hover:border-emerald-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Sumar a la Orden (+${pkg.suggestedExtraArs.toLocaleString('es-AR')})</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
