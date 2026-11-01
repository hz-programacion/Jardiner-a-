import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  CloudSun,
  Compass,
  Navigation,
  Pencil,
  Plus,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  CalendarViewMode,
  ClientProperty,
  InvoiceRecord,
  ScheduledJob,
} from '../types/lawn';
import {
  buildGoogleMapsNavUrl,
  buildMonthCalendarGrid,
  buildWeekDaysForDate,
  computeEndTimeFromStart,
  getClientPriceHistory,
  getWeatherForDate,
} from '../utils/lawnLogic';

const WORK_HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface CalendarAgendaViewProps {
  selectedDate: string; // YYYY-MM-DD
  todayStr: string;
  baseCity?: string;
  allJobs: ScheduledJob[];
  properties: ClientProperty[];
  invoices: InvoiceRecord[];
  onSelectDate: (dateStr: string) => void;
  onOpenRouteForDate: (dateStr: string) => void;
  onOpenScheduleModal: (dateStr: string, timeStr?: string) => void;
  onOpenNewClientForDate: (dateStr: string, timeStr?: string) => void;
  onStartCompleteJob: (job: ScheduledJob) => void;
  onEditScheduledJob: (job: ScheduledJob) => void;
  onRemoveScheduledJob: (jobId: string, clientName: string) => void;
  onRainDelayDate?: (dateStr: string) => void;
}

export function CalendarAgendaView({
  selectedDate,
  todayStr,
  baseCity = 'Venado Tuerto',
  allJobs,
  invoices,
  onSelectDate,
  onOpenRouteForDate,
  onOpenScheduleModal,
  onOpenNewClientForDate,
  onStartCompleteJob,
  onEditScheduledJob,
  onRemoveScheduledJob,
  onRainDelayDate,
}: CalendarAgendaViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('semana');

  const selectedDateParts = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return {
      year: y || 2026,
      monthIndex: (m || 11) - 1,
      day: d || 1,
    };
  }, [selectedDate]);

  const selectedDayWeather = useMemo(
    () => getWeatherForDate(selectedDate, baseCity),
    [selectedDate, baseCity]
  );

  const shiftDate = (daysDelta: number) => {
    const base = new Date(`${selectedDate}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) return;
    base.setUTCDate(base.getUTCDate() + daysDelta);
    onSelectDate(base.toISOString().slice(0, 10));
  };

  const shiftByMode = (direction: -1 | 1) => {
    if (viewMode === 'dia') {
      shiftDate(direction);
    } else if (viewMode === 'semana') {
      shiftDate(direction * 7);
    } else {
      const nextMonth = new Date(
        Date.UTC(
          selectedDateParts.year,
          selectedDateParts.monthIndex + direction,
          1,
          12,
          0,
          0
        )
      );
      onSelectDate(nextMonth.toISOString().slice(0, 10));
    }
  };

  const dayJobs = useMemo(
    () =>
      allJobs
        .filter((j) => j.scheduledDate === selectedDate)
        .sort((a, b) =>
          (a.scheduledTime || '08:00').localeCompare(
            b.scheduledTime || '08:00'
          )
        ),
    [allJobs, selectedDate]
  );

  const weekCells = useMemo(
    () => buildWeekDaysForDate(selectedDate, allJobs, todayStr),
    [selectedDate, allJobs, todayStr]
  );

  const monthCells = useMemo(
    () =>
      buildMonthCalendarGrid(
        selectedDateParts.year,
        selectedDateParts.monthIndex,
        allJobs,
        selectedDate,
        todayStr
      ),
    [
      selectedDateParts.year,
      selectedDateParts.monthIndex,
      allJobs,
      selectedDate,
      todayStr,
    ]
  );

  const daySummary = useMemo(() => {
    const totalRevenue = dayJobs.reduce((acc, j) => acc + j.price, 0);
    const totalMinutes = dayJobs.reduce(
      (acc, j) => acc + j.estimatedMinutes,
      0
    );
    const completedCount = dayJobs.filter(
      (j) => j.status === 'Completado'
    ).length;
    return { totalRevenue, totalMinutes, completedCount };
  }, [dayJobs]);

  const formattedDateHeader = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return selectedDate;
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [selectedDate]);

  return (
    <div className="space-y-5">
      {/* Top Calendar Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-700" />
            <span>Agenda Operativa y Ventana de Corte</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-emerald-800">
              {MONTH_NAMES[selectedDateParts.monthIndex]} {selectedDateParts.year}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1 font-mono font-semibold ${
                selectedDayWeather.isRainRisk
                  ? 'text-sky-700'
                  : 'text-amber-700'
              }`}
            >
              {selectedDayWeather.condition === 'Alerta Lluvia' ? (
                <CloudRain className="w-3.5 h-3.5 text-sky-600" />
              ) : selectedDayWeather.condition === 'Parcialmente Nublado' ? (
                <CloudSun className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>
                {selectedDayWeather.condition} {selectedDayWeather.tempMax}°C (
                {selectedDayWeather.rainProb}% lluvia) —{' '}
                {selectedDayWeather.cuttingWindowLabel}
              </span>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 capitalize">
            {formattedDateHeader}
          </h2>
          <p className="text-xs text-slate-600 tabular-nums">
            {dayJobs.length} trabajos en esta fecha
            <span aria-hidden="true"> · </span>
            Facturación prevista:{' '}
            <span className="font-mono font-bold text-emerald-800">
              ${daySummary.totalRevenue.toLocaleString('es-AR')}
            </span>
            <span aria-hidden="true"> · </span>
            Carga estimada: ~{Math.round((daySummary.totalMinutes / 60) * 10) / 10} hs
          </p>
        </div>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          {/* Segmented View Switcher: Día | Semana | Mes */}
          <div
            role="group"
            aria-label="Modo de vista del calendario"
            className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200"
          >
            {(
              [
                { id: 'dia', label: 'Día' },
                { id: 'semana', label: 'Semana' },
                { id: 'mes', label: 'Mes' },
              ] as { id: CalendarViewMode; label: string }[]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === mode.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Date Navigation Controls */}
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => shiftByMode(-1)}
              aria-label="Período anterior"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectDate(todayStr)}
              className="min-h-[34px] px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-white rounded-lg transition-colors whitespace-nowrap"
            >
              Hoy ({todayStr.slice(5)})
            </button>
            <button
              type="button"
              onClick={() => shiftByMode(1)}
              aria-label="Período siguiente"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDayWeather.isRainRisk && onRainDelayDate && dayJobs.length > 0 && (
            <button
              type="button"
              onClick={() => onRainDelayDate(selectedDate)}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-900 bg-sky-100 border border-sky-300 rounded-xl hover:bg-sky-200 transition-colors whitespace-nowrap shrink-0"
            >
              <CloudRain className="w-3.5 h-3.5 text-sky-700" />
              <span>Posponer Día por Lluvia (+1d)</span>
            </button>
          )}

          {/* Primary Actions for Selected Date */}
          <button
            type="button"
            onClick={() => onOpenScheduleModal(selectedDate, '08:00')}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Programar Corte</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenRouteForDate(selectedDate)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ruta GPS del Día</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: VISTA POR DÍA (Cronograma Horario 07:00 a 18:00) */}
      {viewMode === 'dia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Hourly Schedule Grid */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800">
                Cronograma por Hora ({selectedDate})
              </div>
              <button
                type="button"
                onClick={() => onOpenNewClientForDate(selectedDate, '09:00')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cliente Nuevo en esta Fecha</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {WORK_HOURS.map((hourSlot) => {
                const hourPrefix = hourSlot.slice(0, 2);
                const slotJobs = dayJobs.filter((j) =>
                  (j.scheduledTime || '08:00').startsWith(hourPrefix)
                );

                return (
                  <div
                    key={hourSlot}
                    className="grid grid-cols-12 min-h-[64px] hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="col-span-2 sm:col-span-2 py-3 px-3 border-r border-slate-100 flex flex-col justify-between">
                      <span className="font-mono text-xs font-bold text-slate-600 tabular-nums">
                        {hourSlot} hs
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenScheduleModal(selectedDate, hourSlot)
                        }
                        className="text-[11px] font-semibold text-emerald-700 hover:underline text-left mt-1 whitespace-nowrap"
                      >
                        + Agendar
                      </button>
                    </div>

                    <div className="col-span-10 sm:col-span-10 p-2.5 space-y-2">
                      {slotJobs.length === 0 ? (
                        <div className="h-full flex items-center justify-between text-xs text-slate-400 px-2">
                          <span>Horario libre</span>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenScheduleModal(selectedDate, hourSlot)
                            }
                            className="text-xs font-medium text-slate-500 hover:text-emerald-700 whitespace-nowrap"
                          >
                            Asignar cliente a las {hourSlot}
                          </button>
                        </div>
                      ) : (
                        slotJobs.map((job) => {
                          const endTime = computeEndTimeFromStart(
                            job.scheduledTime || hourSlot,
                            job.estimatedMinutes
                          );
                          const history = getClientPriceHistory(
                            job.propertyId,
                            job.clientName,
                            invoices
                          );
                          const isCompleted = job.status === 'Completado';

                          return (
                            <div
                              key={job.id}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isCompleted
                                  ? 'bg-slate-50 border-slate-200 opacity-85'
                                  : 'bg-emerald-50/40 border-emerald-200/90'
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-600 tabular-nums">
                                  <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span className="font-bold text-slate-900">
                                    {job.scheduledTime} – {endTime} hs
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>~{job.estimatedMinutes} min</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-sans font-semibold text-emerald-800">
                                    {job.status}
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-slate-900">
                                  {job.clientName} — {job.address}
                                </div>
                                <div className="text-xs text-slate-600">
                                  {job.neighborhood} · {job.propertyType} ·{' '}
                                  <span className="font-mono tabular-nums">
                                    {job.areaSqm} m²
                                  </span>
                                  {history.lastAmount && (
                                    <span>
                                      {' '}
                                      · Último cobro: $
                                      {history.lastAmount.toLocaleString(
                                        'es-AR'
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right mr-1">
                                  <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                                    ${job.price.toLocaleString('es-AR')}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {job.frequency}
                                  </div>
                                </div>

                                <a
                                  href={buildGoogleMapsNavUrl(job.coordinates)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Cómo llegar en Google Maps"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                                >
                                  <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Mapa</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => onEditScheduledJob(job)}
                                  title="Modificar fecha, hora, dirección o precio de esta cita"
                                  className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Editar / Mover</span>
                                </button>

                                {!isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => onStartCompleteJob(job)}
                                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Cobrar</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveScheduledJob(job.id, job.clientName)
                                  }
                                  title="Quitar de la agenda"
                                  aria-label={`Quitar corte de ${job.clientName}`}
                                  className="min-h-[36px] p-2 text-slate-400 hover:text-red-600 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Summary of Selected Day & Quick Actions */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0F291E] text-white rounded-2xl p-5 space-y-4">
              <div>
                <div className="text-xs font-mono text-emerald-300">
                  RESUMEN DEL DÍA · {selectedDate}
                </div>
                <h3 className="text-base font-bold mt-1">
                  {dayJobs.length} Cortes Programados
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-800/70">
                <div>
                  <div className="text-xs text-emerald-200/80">
                    Total Estimado
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                    ${daySummary.totalRevenue.toLocaleString('es-AR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-emerald-200/80">
                    Tiempo de Corte
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                    {Math.floor(daySummary.totalMinutes / 60)}h{' '}
                    {daySummary.totalMinutes % 60}m
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenRouteForDate(selectedDate)}
                  className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition-colors whitespace-nowrap"
                >
                  <Compass className="w-4 h-4" />
                  <span>Abrir Ruta Optimizada de este Día</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScheduleModal(selectedDate, '08:30')}
                  className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-900/90 text-emerald-100 border border-emerald-700 rounded-xl hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agendar Cliente Existente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: VISTA SEMANAL (7 Columnas Lunes a Domingo) */}
      {viewMode === 'semana' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekCells.map((cell) => {
            const isSelected = cell.dateStr === selectedDate;
            const cellWeather = getWeatherForDate(cell.dateStr, baseCity);
            return (
              <div
                key={cell.dateStr}
                className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
                  isSelected
                    ? 'border-emerald-700 ring-2 ring-emerald-700/15 shadow-xs'
                    : cellWeather.isRainRisk
                    ? 'border-sky-300/90'
                    : 'border-slate-200/90'
                }`}
              >
                <div>
                  {/* Day Header */}
                  <div
                    onClick={() => onSelectDate(cell.dateStr)}
                    className={`p-3 border-b cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#0F291E] text-white border-emerald-900'
                        : cell.isToday
                        ? 'bg-emerald-50/80 text-slate-900 border-emerald-200'
                        : 'bg-slate-50/70 text-slate-900 border-slate-200'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-[11px] font-semibold uppercase ${
                          isSelected ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {cell.weekdayShort}
                        {cell.isToday ? ' · Hoy' : ''}
                      </div>
                      <div className="text-base font-bold font-mono tabular-nums">
                        {cell.dayOfMonth}/{cell.dateStr.slice(5, 7)}
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div
                        className={`text-xs font-bold ${
                          isSelected ? 'text-emerald-300' : 'text-emerald-800'
                        }`}
                      >
                        ${cell.totalRevenue.toLocaleString('es-AR')}
                      </div>
                      <div
                        className={`text-[11px] ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cell.jobs.length} cortes
                      </div>
                    </div>
                  </div>

                  {/* Weather & Cutting Window Strip for the Day */}
                  <div
                    onClick={() => onSelectDate(cell.dateStr)}
                    className={`px-3 py-1.5 border-b text-[11px] font-mono flex items-center justify-between cursor-pointer ${
                      cellWeather.isRainRisk
                        ? 'bg-sky-50 text-sky-900 border-sky-200 font-semibold'
                        : 'bg-amber-50/40 text-slate-600 border-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1 truncate">
                      {cellWeather.condition === 'Alerta Lluvia' ? (
                        <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                      ) : cellWeather.condition === 'Parcialmente Nublado' ? (
                        <CloudSun className="w-3 h-3 text-amber-600 shrink-0" />
                      ) : (
                        <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {cellWeather.isRainRisk ? 'Lluvia' : 'Seco'}{' '}
                        {cellWeather.tempMax}°C
                      </span>
                    </span>
                    <span className="tabular-nums shrink-0">
                      {cellWeather.rainProb}% 💧
                    </span>
                  </div>

                  {/* Jobs inside the Day Column */}
                  <div className="p-2.5 space-y-2 md:min-h-[210px]">
                    {cell.jobs.length === 0 ? (
                      <div className="py-4 md:h-36 flex flex-col items-center justify-center text-center p-2 text-xs text-slate-400">
                        <span>Sin cortes agendados</span>
                      </div>
                    ) : (
                      cell.jobs.map((job) => {
                        const endTime = computeEndTimeFromStart(
                          job.scheduledTime || '08:00',
                          job.estimatedMinutes
                        );
                        return (
                          <div
                            key={job.id}
                            onClick={() => onSelectDate(cell.dateStr)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                              job.status === 'Completado'
                                ? 'bg-slate-50 border-slate-200 text-slate-600'
                                : 'bg-white border-slate-200 hover:border-emerald-600'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-800 font-bold tabular-nums">
                              <span>
                                {job.scheduledTime}–{endTime}
                              </span>
                              <span>${job.price.toLocaleString('es-AR')}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                              {job.clientName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {job.address} · {job.neighborhood}
                            </div>
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditScheduledJob(job);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Editar / Mover</span>
                              </button>
                              {job.status !== 'Completado' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onStartCompleteJob(job);
                                  }}
                                  className="text-[11px] font-bold text-slate-700 hover:text-emerald-800"
                                >
                                  Cobrar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Column Footer Actions */}
                <div className="p-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenScheduleModal(cell.dateStr, '08:30')}
                    className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agendar</span>
                  </button>
                  {cell.jobs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenRouteForDate(cell.dateStr)}
                      title="Ver ruta en mapa"
                      className="min-h-[34px] px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
                    >
                      Ruta
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: VISTA MENSUAL (Grilla Completa de Mes + Detalle Interactivo del Día Seleccionado) */}
      {viewMode === 'mes' && (
        <div className="space-y-4">
          <div className="surface-card rounded-2xl overflow-hidden">
            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center py-2.5 text-[11px] sm:text-xs font-bold text-slate-600">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* 35/42 Day Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
              {monthCells.map((cell) => {
                const isSelected = cell.dateStr === selectedDate;
                const cellWeather = getWeatherForDate(cell.dateStr, baseCity);
                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => onSelectDate(cell.dateStr)}
                    className={`min-h-[68px] sm:min-h-[118px] p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-colors ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-50/50 text-slate-400'
                        : isSelected
                        ? 'bg-emerald-50/60 ring-2 ring-inset ring-emerald-700'
                        : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-0.5">
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          cell.isToday
                            ? 'text-emerald-800 underline'
                            : cell.isCurrentMonth
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayOfMonth}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-500 tabular-nums">
                        {cellWeather.isRainRisk ? (
                          <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                        ) : (
                          <Sun className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                        <span className="hidden sm:inline">
                          {cellWeather.tempMax}°
                        </span>
                      </span>
                    </div>

                    {/* Mobile compact summary inside cell */}
                    <div className="sm:hidden my-1">
                      {cell.jobs.length > 0 ? (
                        <div className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded px-1 py-0.5 text-center tabular-nums">
                          {cell.jobs.length} {cell.jobs.length === 1 ? 'corte' : 'cortes'}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-300 text-center">
                          —
                        </div>
                      )}
                    </div>

                    {/* Desktop job list inside cell */}
                    <div className="hidden sm:block space-y-1 my-1">
                      {cell.jobs.slice(0, 3).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditScheduledJob(job);
                          }}
                          title={`Editar cita de ${job.clientName} (${job.scheduledTime} hs)`}
                          className="w-full text-left text-[11px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-800 truncate font-medium transition-colors"
                        >
                          <span className="font-mono font-semibold text-emerald-800">
                            {job.scheduledTime}
                          </span>{' '}
                          {job.clientName}
                        </button>
                      ))}
                      {cell.jobs.length > 3 && (
                        <div className="text-[10px] font-mono text-slate-500 pl-1">
                          +{cell.jobs.length - 3} más...
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenScheduleModal(cell.dateStr, '08:00');
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        + Agendar
                      </button>
                      {cell.jobs.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRouteForDate(cell.dateStr);
                          }}
                          className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 underline"
                        >
                          Ver Ruta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Detail Panel for Selected Date in Month View */}
          <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div>
                <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 capitalize">
                  Trabajos del {formattedDateHeader} ({dayJobs.length})
                </h3>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  Total estimado: ${daySummary.totalRevenue.toLocaleString('es-AR')} ·{' '}
                  {selectedDayWeather.condition} ({selectedDayWeather.tempMax}°C)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenScheduleModal(selectedDate, '08:30')}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agendar en este Día</span>
                </button>
                {dayJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenRouteForDate(selectedDate)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Ruta GPS</span>
                  </button>
                )}
              </div>
            </div>

            {dayJobs.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No hay cortes programados para el {selectedDate}. Toca &ldquo;Agendar en este Día&rdquo; para asignar un cliente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dayJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/60 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-emerald-800 tabular-nums">
                        {job.scheduledTime} hs · ${job.price.toLocaleString('es-AR')}
                      </div>
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {job.clientName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {job.address} · {job.neighborhood}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditScheduledJob(job)}
                        className="min-h-[34px] px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      {job.status !== 'Completado' && (
                        <button
                          type="button"
                          onClick={() => onStartCompleteJob(job)}
                          className="min-h-[34px] px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                        >
                          Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
