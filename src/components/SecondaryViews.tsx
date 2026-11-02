import React, { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Fuel,
  History,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Wrench,
} from 'lucide-react';
import {
  BusinessProfileConfig,
  ClientProperty,
  CutFrequency,
  EquipmentItem,
  GrassCondition,
  InvoiceRecord,
  OperationalExpense,
  PeriodFilter,
  PropertyType,
  ScheduledJob,
} from '../types/lawn';
import {
  calculateFinancialSummary,
  calculateSuggestedPrice,
  computeDetailedAnalytics,
  filterRecordsByPeriod,
  getClientCutTimeHistory,
  getClientPriceHistory,
  getTodayIsoLocal,
} from '../utils/lawnLogic';
import { NEIGHBORHOOD_COORDINATES } from '../data/seedData';
import { StreetAddressAutocomplete } from './StreetAddressAutocomplete';

interface ClientsViewProps {
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  paymentAlias?: string;
  onOpenNewClient: () => void;
  onEditClient: (property: ClientProperty) => void;
  onViewClientHistory: (property: ClientProperty) => void;
  onRequestDeleteClient: (property: ClientProperty) => void;
  onAddPropertyToToday: (property: ClientProperty) => void;
  onScheduleClient: (property: ClientProperty) => void;
  onBulkUpdatePrices?: (percent: number, onlyOutdated: boolean) => void;
  onOpenAliasModal?: () => void;
  onSettleClientPendingInvoices?: (clientPropertyId: string) => void;
}

export function ClientsView({
  properties,
  todayJobs,
  invoices,
  paymentAlias = 'mi.alias.cobro',
  onOpenNewClient,
  onEditClient,
  onViewClientHistory,
  onRequestDeleteClient,
  onAddPropertyToToday,
  onScheduleClient,
  onBulkUpdatePrices,
  onOpenAliasModal,
  onSettleClientPendingInvoices,
}: ClientsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('Todos');
  const [filterZone, setFilterZone] = useState<string>('Todas');
  const [filterBalance, setFilterBalance] = useState<'todos' | 'con_deuda'>('todos');
  const [sortBy, setSortBy] = useState<'nombre' | 'tarifa_mayor' | 'proximo_corte'>('nombre');
  const [onlyOutdated, setOnlyOutdated] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const matching = properties.filter((prop) => {
      const matchesSearch =
        prop.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prop.neighborhood.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === 'Todos' || prop.propertyType === filterType;
      const matchesZone =
        filterZone === 'Todas' ||
        (filterZone === 'Venado Tuerto'
          ? prop.neighborhood.toLowerCase().includes('venado tuerto')
          : !prop.neighborhood.toLowerCase().includes('venado tuerto'));

      if (!matchesSearch || !matchesType || !matchesZone) return false;

      if (filterBalance === 'con_deuda') {
        const history = getClientPriceHistory(prop.id, prop.clientName, invoices);
        return history.pendingBalance > 0;
      }
      return true;
    });

    return [...matching].sort((a, b) => {
      if (sortBy === 'tarifa_mayor') return b.basePrice - a.basePrice;
      if (sortBy === 'proximo_corte') return a.nextCutDate.localeCompare(b.nextCutDate);
      return a.clientName.localeCompare(b.clientName, 'es');
    });
  }, [properties, searchQuery, filterType, filterZone, filterBalance, sortBy, invoices]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 surface-card rounded-2xl p-4 sm:p-5">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
            Cartera de Clientes y Propiedades ({filtered.length} de {properties.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulta cuánto le cobraste anteriormente a cada cliente, ajusta tarifas por inflación o salda cobros pendientes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, calle o zona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            aria-label="Filtrar por localidad"
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium"
          >
            <option value="Todas">Todas las zonas</option>
            <option value="Venado Tuerto">Zona Centro / Urbana</option>
            <option value="Pueblos">Zonas Residenciales / Ruta</option>
          </select>

          <select
            aria-label="Filtrar por tipo de propiedad"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium"
          >
            <option value="Todos">Todos los lotes</option>
            <option value="Casa">Casas</option>
            <option value="Terreno">Terrenos</option>
            <option value="Quinta">Quintas</option>
          </select>

          <select
            aria-label="Filtrar por estado de saldo"
            value={filterBalance}
            onChange={(e) => setFilterBalance(e.target.value as 'todos' | 'con_deuda')}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium"
          >
            <option value="todos">Todos los saldos</option>
            <option value="con_deuda">Con saldo pendiente</option>
          </select>

          <select
            aria-label="Ordenar clientes"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'nombre' | 'tarifa_mayor' | 'proximo_corte')
            }
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-medium"
          >
            <option value="nombre">Orden: A-Z</option>
            <option value="tarifa_mayor">Mayor tarifa</option>
            <option value="proximo_corte">Próximo corte</option>
          </select>

          <button
            type="button"
            onClick={onOpenNewClient}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Opción 3: Actualización de Tarifas por Inflación en 1 Clic + Alias Bancario */}
      {onBulkUpdatePrices && (
        <div className="surface-command text-white rounded-2xl p-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ACTUALIZAR TARIFAS POR INFLACIÓN (1 CLIC):</span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs text-emerald-100 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyOutdated}
                onChange={(e) => setOnlyOutdated(e.target.checked)}
                className="rounded border-emerald-500 text-emerald-500"
              />
              <span>Solo clientes sin actualizar (+20 días)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onBulkUpdatePrices(pct, onlyOutdated)}
                className="min-h-[34px] px-3 py-1 text-xs font-mono font-bold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors whitespace-nowrap"
              >
                Aplicar +{pct}%
              </button>
            ))}

            {onOpenAliasModal && (
              <button
                type="button"
                onClick={onOpenAliasModal}
                className="min-h-[34px] px-3 py-1 text-xs font-mono font-semibold text-emerald-100 bg-emerald-900/90 border border-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Alias Cobro: {paymentAlias}
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No se encontraron clientes con ese filtro
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Agrega un nuevo cliente en tu cartera con el botón &ldquo;Nuevo Cliente&rdquo;.
          </p>
        </div>
      ) : (
        <>
          {/* Vista de Tarjetas para Celular */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((prop) => {
              const alreadyInToday = todayJobs.some(
                (j) => j.propertyId === prop.id
              );
              const history = getClientPriceHistory(
                prop.id,
                prop.clientName,
                invoices
              );
              const cutTimeSummary = getClientCutTimeHistory(
                prop.id,
                prop.clientName,
                invoices,
                todayJobs,
                prop.estimatedMinutes,
                prop.areaSqm
              );
              const cleanPhone = prop.phone.replace(/[^0-9]/g, '');

              return (
                <div
                  key={prop.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 min-w-0 break-words"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm break-words">
                        {prop.clientName}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 break-words">
                        {prop.address} · {prop.neighborhood}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums flex flex-wrap items-center gap-1.5">
                        <span>
                          {prop.propertyType} · {prop.areaSqm} m² ·{' '}
                          {prop.frequency}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-semibold">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            Prom:{' '}
                            {cutTimeSummary.averageMinutes ??
                              prop.estimatedMinutes}{' '}
                            min
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                        ${prop.basePrice.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Tarifa actual
                      </div>
                    </div>
                  </div>

                  {/* Cuánto se le cobró anteriormente */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                    <div className="min-w-0 break-words">
                      <span className="font-semibold text-slate-700">
                        Último cobro:
                      </span>{' '}
                      {history.lastAmount ? (
                        <span className="font-mono font-bold text-emerald-800">
                          ${history.lastAmount.toLocaleString('es-AR')} (
                          {history.lastDate})
                        </span>
                      ) : (
                        <span className="text-slate-500">Sin cortes previos</span>
                      )}
                      {cutTimeSummary.lastDurationMinutes && (
                        <div className="text-[11px] text-teal-800 font-mono mt-0.5">
                          Último tiempo real: {cutTimeSummary.lastDurationMinutes} min (Est: {prop.estimatedMinutes} min)
                        </div>
                      )}
                      {history.previousAmount && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Cobro anterior: $
                          {history.previousAmount.toLocaleString('es-AR')} (
                          {history.previousDate})
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewClientHistory(prop)}
                      className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shrink-0"
                    >
                      <History className="w-3.5 h-3.5 shrink-0" />
                      <span>Historial ({history.totalCutsCount})</span>
                    </button>
                  </div>

                  {history.pendingBalance > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs font-medium text-amber-900 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1.5 font-mono tabular-nums">
                      <span>
                        Saldo pendiente: $
                        {history.pendingBalance.toLocaleString('es-AR')}
                      </span>
                      {onSettleClientPendingInvoices && (
                        <button
                          type="button"
                          onClick={() => onSettleClientPendingInvoices(prop.id)}
                          className="font-sans font-semibold text-[11px] px-2 py-0.5 bg-emerald-700 text-white rounded-md hover:bg-emerald-800"
                        >
                          Saldar deuda
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditClient(prop)}
                        className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRequestDeleteClient(prop)}
                        aria-label={`Eliminar cliente ${prop.clientName}`}
                        className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>

                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onScheduleClient(prop)}
                        className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Agendar</span>
                      </button>

                      {alreadyInToday ? (
                        <span className="text-xs font-semibold text-emerald-700 px-2 py-1">
                          ✓ En Ruta
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddPropertyToToday(prop)}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Sumar Hoy</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vista de Tabla para Escritorio */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Cliente y Contacto</th>
                    <th className="py-3 px-4">Dirección · Barrio / Pueblo</th>
                    <th className="py-3 px-4">Lote y Frecuencia</th>
                    <th className="py-3 px-4">Cobros Anteriores al Cliente</th>
                    <th className="py-3 px-4 text-right">Tarifa Actual y Saldo</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filtered.map((prop) => {
                    const alreadyInToday = todayJobs.some(
                      (j) => j.propertyId === prop.id
                    );
                    const history = getClientPriceHistory(
                      prop.id,
                      prop.clientName,
                      invoices
                    );
                    const cutTimeSummary = getClientCutTimeHistory(
                      prop.id,
                      prop.clientName,
                      invoices,
                      todayJobs,
                      prop.estimatedMinutes,
                      prop.areaSqm
                    );
                    const cleanPhone = prop.phone.replace(/[^0-9]/g, '');

                    return (
                      <tr
                        key={prop.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-4 align-top break-words">
                          <div className="font-semibold text-slate-900">
                            {prop.clientName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                            <span>{prop.phone}</span>
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:underline font-sans font-medium"
                            >
                              WhatsApp
                            </a>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top break-words">
                          <div className="text-slate-800 font-medium">
                            {prop.address}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {prop.neighborhood}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-slate-800 font-medium">
                            {prop.propertyType} ·{' '}
                            <span className="font-mono tabular-nums">
                              {prop.areaSqm} m²
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {prop.frequency} · Próx: {prop.nextCutDate}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-semibold">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              Prom:{' '}
                              {cutTimeSummary.averageMinutes ??
                                prop.estimatedMinutes}{' '}
                              min
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          {history.lastAmount ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono text-slate-900">
                                <span className="text-slate-500 font-sans">
                                  Último ({history.lastDate}):
                                </span>{' '}
                                <span className="font-bold text-emerald-800">
                                  ${history.lastAmount.toLocaleString('es-AR')}
                                </span>
                              </div>
                              {history.previousAmount && (
                                <div className="text-[11px] font-mono text-slate-500">
                                  Anterior ({history.previousDate}): $
                                  {history.previousAmount.toLocaleString('es-AR')}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => onViewClientHistory(prop)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline mt-0.5"
                              >
                                <History className="w-3 h-3" />
                                <span>
                                  Ver los {history.totalCutsCount} cobros (Total: $
                                  {history.totalBilled.toLocaleString('es-AR')})
                                </span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Sin cobros registrados aún
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums">
                          <div className="font-bold text-slate-900">
                            ${prop.basePrice.toLocaleString('es-AR')}
                          </div>
                          {history.pendingBalance > 0 ? (
                            <div className="mt-0.5 space-y-1">
                              <div className="text-xs font-semibold text-amber-700">
                                Debe: $
                                {history.pendingBalance.toLocaleString('es-AR')}
                              </div>
                              {onSettleClientPendingInvoices && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSettleClientPendingInvoices(prop.id)
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-sans font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Saldar</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Al día
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onScheduleClient(prop)}
                              title="Programar corte con fecha y horario en el calendario"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Programar</span>
                            </button>

                            {alreadyInToday ? (
                              <span className="text-xs font-medium text-emerald-700 px-2 py-1 whitespace-nowrap">
                                En Ruta
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAddPropertyToToday(prop)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                              >
                                + Hoy
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onViewClientHistory(prop)}
                              title="Ver historial de cobros a este cliente"
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onEditClient(prop)}
                              title="Editar cliente"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onRequestDeleteClient(prop)}
                              title="Eliminar cliente"
                              aria-label={`Eliminar ${prop.clientName}`}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface QuoteCalculatorViewProps {
  activeCity?: string;
  businessProfile?: BusinessProfileConfig;
  existingProperties?: ClientProperty[];
  onConvertQuoteToClient: (prefill: Partial<ClientProperty>) => void;
  onOpenBusinessProfile?: () => void;
}

export function QuoteCalculatorView({
  activeCity = 'Venado Tuerto',
  businessProfile,
  existingProperties = [],
  onConvertQuoteToClient,
  onOpenBusinessProfile,
}: QuoteCalculatorViewProps) {
  const [inputMode, setInputMode] = useState<'dimensions' | 'sqm'>('dimensions');
  const [widthMeters, setWidthMeters] = useState('12');
  const [lengthMeters, setLengthMeters] = useState('35');
  const [directSqm, setDirectSqm] = useState('420');
  const [propertyType, setPropertyType] = useState<PropertyType>('Casa');
  const [grassCondition, setGrassCondition] =
    useState<GrassCondition>('Regular');
  const [frequency, setFrequency] = useState<CutFrequency>('Quincenal');
  const [includesBagging, setIncludesBagging] = useState(true);
  const [extraTasksCount, setExtraTasksCount] = useState(0);
  const [selectedTown, setSelectedTown] = useState('Venado Tuerto - Centro');
  const [travelFee, setTravelFee] = useState('0');

  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectAddress, setProspectAddress] = useState('');

  const computedSqm =
    inputMode === 'dimensions'
      ? Math.max(
          20,
          Math.round((Number(widthMeters) || 10) * (Number(lengthMeters) || 10))
        )
      : Math.max(20, Number(directSqm) || 100);

  const baseQuote = calculateSuggestedPrice(
    computedSqm,
    propertyType,
    frequency,
    extraTasksCount,
    grassCondition,
    includesBagging,
    businessProfile
      ? {
          baseRatePerSqm: businessProfile.baseRatePerSqm,
          minServicePrice: businessProfile.minServicePrice,
        }
      : undefined
  );

  const parsedTravelFee = Math.max(0, Number(travelFee) || 0);
  const totalSuggestedPrice = baseQuote.suggestedPrice + parsedTravelFee;
  const pricePerSqm = Math.round(totalSuggestedPrice / computedSqm);

  const handleTownChange = (zone: string) => {
    setSelectedTown(zone);
    if (zone.startsWith('Venado Tuerto')) {
      setTravelFee('0');
    } else if (
      zone.includes('Murphy') ||
      zone.includes('San Eduardo') ||
      zone.includes('Carmen') ||
      zone.includes('Chapuy')
    ) {
      setTravelFee('8500');
    } else {
      setTravelFee('14000');
    }
  };

  const brandSignature = businessProfile?.appName || 'PastoPro';
  const whatsappQuoteMessage = `Hola${
    prospectName ? ` ${prospectName}` : ''
  }! Te paso el presupuesto de ${brandSignature} para corte de pasto y mantenimiento en ${selectedTown}${
    prospectAddress ? ` (${prospectAddress})` : ''
  }:
• Superficie: ${computedSqm} m² (${propertyType})
• Estado del pasto: ${grassCondition}
• Incluye: Corte completo, bordeado perimetral${
    includesBagging ? ' y embolsado final' : ' y soplado de vereda'
  }${
    parsedTravelFee > 0
      ? `\n• Traslado de equipos a localidad: $${parsedTravelFee.toLocaleString('es-AR')}`
      : ''
  }
• Frecuencia: ${frequency}
• Valor total del servicio: $${totalSuggestedPrice.toLocaleString('es-AR')}
• Tiempo estimado: ~${baseQuote.estimatedMinutes} min.
Avisame si te queda bien y coordinamos día y horario!`;

  const cleanPhone = prospectPhone.replace(/[^0-9]/g, '');
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        whatsappQuoteMessage
      )}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappQuoteMessage)}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-slate-900">
                Cotizador Rápido · {brandSignature}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Base configurada: ${businessProfile?.baseRatePerSqm || 65}/m² · Mínimo: $
              {(businessProfile?.minServicePrice || 18000).toLocaleString('es-AR')}
            </p>
          </div>
          {onOpenBusinessProfile && (
            <button
              type="button"
              onClick={onOpenBusinessProfile}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar mi tarifa $/m²</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="quote-town-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Localidad / Barrio del Trabajo
              </label>
              <select
                id="quote-town-select"
                value={selectedTown}
                onChange={(e) => handleTownChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                {Object.keys(NEIGHBORHOOD_COORDINATES).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="quote-travel-fee"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Adicional Traslado / Ruta ($)
              </label>
              <input
                id="quote-travel-fee"
                type="number"
                min={0}
                step={500}
                value={travelFee}
                onChange={(e) => setTravelFee(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              ¿Cómo te pasó las medidas el cliente?
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInputMode('dimensions')}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  inputMode === 'dimensions'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Por Frente × Fondo (Ej. 12m × 35m)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('sqm')}
                className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  inputMode === 'sqm'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Metros Cuadrados Directos (m²)
              </button>
            </div>
          </div>

          {inputMode === 'dimensions' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="quote-width"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Ancho / Frente (metros)
                </label>
                <input
                  id="quote-width"
                  type="number"
                  min={2}
                  max={500}
                  value={widthMeters}
                  onChange={(e) => setWidthMeters(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="quote-length"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Largo / Fondo (metros)
                </label>
                <input
                  id="quote-length"
                  type="number"
                  min={2}
                  max={500}
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="quote-sqm"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Superficie Total (m²)
              </label>
              <input
                id="quote-sqm"
                type="number"
                min={20}
                max={20000}
                value={directSqm}
                onChange={(e) => setDirectSqm(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="quote-prop-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Tipo de Propiedad
              </label>
              <select
                id="quote-prop-type"
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as PropertyType)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Casa">Casa con jardín</option>
                <option value="Terreno">Terreno baldío / Lote</option>
                <option value="Quinta">Quinta / Parque grande</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quote-grass-cond"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Altura / Estado del Pasto
              </label>
              <select
                id="quote-grass-cond"
                value={grassCondition}
                onChange={(e) =>
                  setGrassCondition(e.target.value as GrassCondition)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Regular">Mantenido (&lt;12 cm)</option>
                <option value="Alto">Pasto Alto (15-25 cm · +30%)</option>
                <option value="Maleza Pesada">
                  Maleza Pesada / Cardos (+65%)
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quote-freq"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Frecuencia de Corte
              </label>
              <select
                id="quote-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as CutFrequency)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="Semanal">Semanal (-10% abono)</option>
                <option value="Quincenal">Quincenal (Tarifa base)</option>
                <option value="Mensual">Mensual (+25%)</option>
                <option value="Única vez">Limpieza única vez (+35%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer p-2.5 border border-slate-200 rounded-lg bg-slate-50">
              <input
                type="checkbox"
                checked={includesBagging}
                onChange={(e) => setIncludesBagging(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              <span>Incluir embolsado y retiro de pasto</span>
            </label>

            <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50">
              <span className="text-xs font-medium text-slate-800">
                Tareas extra (cerco, canteros):
              </span>
              <select
                aria-label="Cantidad de tareas extra"
                value={extraTasksCount}
                onChange={(e) => setExtraTasksCount(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
              >
                <option value={0}>0 extras</option>
                <option value={1}>+1 tarea ($4.500)</option>
                <option value={2}>+2 tareas ($9.000)</option>
                <option value={3}>+3 tareas ($13.500)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Datos del cliente para enviar por WhatsApp o agendarlo (con autocompletado de calles):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
              <input
                type="text"
                placeholder="Nombre (Ej. Carlos)"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="WhatsApp (Ej. 3462554433)"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <StreetAddressAutocomplete
              id="quote-address-autocomplete"
              value={prospectAddress}
              onChange={(nextAddress) => setProspectAddress(nextAddress)}
              onSelectSuggestion={(sug) => {
                setProspectAddress(sug.streetAddress);
                if (
                  sug.neighborhood &&
                  NEIGHBORHOOD_COORDINATES[sug.neighborhood]
                ) {
                  handleTownChange(sug.neighborhood);
                }
              }}
              activeNeighborhood={selectedTown}
              activeCity={activeCity}
              existingProperties={existingProperties}
              placeholder="Empieza a escribir la calle (Ej. Av. Casey 650, Mitre 1100...)"
            />
          </div>
        </div>
      </div>

      {/* Resultado del Presupuesto */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Presupuesto Calculado ({selectedTown})
            </span>
            <div className="text-3xl font-bold font-mono text-slate-900 tabular-nums mt-1">
              ${totalSuggestedPrice.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Superficie: {computedSqm} m² · ~${pricePerSqm}/m²
              {parsedTravelFee > 0
                ? ` (Incluye $${parsedTravelFee.toLocaleString('es-AR')} de viaje)`
                : ''}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">
                Tiempo Operativo
              </div>
              <div className="text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                ~{baseQuote.estimatedMinutes} min
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Corte + bordeado {includesBagging ? '+ embolsado' : ''}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-600" />
                <span>Nafta / Mezcla Est.</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                ~{baseQuote.estimatedFuelLiters} Litros
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Desgaste de máquina incluido
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs font-semibold text-slate-700 mb-1">
              Mensaje listo para enviar por WhatsApp:
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed font-mono">
              {whatsappQuoteMessage}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-200">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar Presupuesto por WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={() =>
              onConvertQuoteToClient({
                clientName: prospectName,
                phone: prospectPhone,
                address: prospectAddress,
                neighborhood: selectedTown,
                propertyType,
                areaSqm: computedSqm,
                grassCondition,
                includesBagging,
                frequency,
                basePrice: totalSuggestedPrice,
              })
            }
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Guardar como Nuevo Cliente en Cartera</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface BillingViewProps {
  activeDate?: string;
  properties: ClientProperty[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
  onToggleInvoicePaid: (invoiceId: string) => void;
  onSelectInvoiceReceipt: (invoice: InvoiceRecord) => void;
  onEditInvoice?: (invoice: InvoiceRecord) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onAddExpense: (expense: Omit<OperationalExpense, 'id'>) => void;
  onUpdateExpense?: (expense: OperationalExpense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onViewClientHistory: (property: ClientProperty) => void;
}

export function BillingView({
  activeDate = getTodayIsoLocal(),
  properties,
  invoices,
  expenses,
  onToggleInvoicePaid,
  onSelectInvoiceReceipt,
  onEditInvoice,
  onDeleteInvoice,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onViewClientHistory,
}: BillingViewProps) {
  const [period, setPeriod] = useState<PeriodFilter>('mes_actual');
  const [customFrom, setCustomFrom] = useState('2026-08-01');
  const [customTo, setCustomTo] = useState(activeDate);
  const [billingSection, setBillingSection] = useState<
    'recibos' | 'gastos' | 'estadisticas'
  >('recibos');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<
    'todos' | 'Pagado' | 'Pendiente'
  >('todos');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [category, setCategory] = useState<OperationalExpense['category']>(
    'Combustible y Aceite 2T'
  );
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(activeDate);

  const { filteredInvoices, filteredExpenses, periodLabel } = useMemo(
    () =>
      filterRecordsByPeriod(invoices, expenses, period, activeDate, {
        from: customFrom,
        to: customTo,
      }),
    [invoices, expenses, period, activeDate, customFrom, customTo]
  );

  const visibleInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => {
      const matchesStatus =
        invoiceStatusFilter === 'todos' || inv.status === invoiceStatusFilter;
      const q = invoiceSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.address.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [filteredInvoices, invoiceStatusFilter, invoiceSearchQuery]);

  const summary = useMemo(
    () => calculateFinancialSummary(filteredInvoices, filteredExpenses),
    [filteredInvoices, filteredExpenses]
  );

  const detailedAnalytics = useMemo(
    () => computeDetailedAnalytics(invoices, expenses, properties),
    [invoices, expenses, properties]
  );

  const handleStartEditExpense = (exp: OperationalExpense) => {
    setBillingSection('gastos');
    setEditingExpenseId(exp.id);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(String(exp.amount));
    setExpenseDate(exp.date);
  };

  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setDescription('');
    setAmount('');
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!description.trim() || !numericAmount || numericAmount <= 0) return;

    if (editingExpenseId && onUpdateExpense) {
      onUpdateExpense({
        id: editingExpenseId,
        date: expenseDate || activeDate || '2026-11-01',
        category,
        description: description.trim(),
        amount: numericAmount,
      });
      setEditingExpenseId(null);
      setDescription('');
      setAmount('');
      return;
    }

    onAddExpense({
      date: expenseDate || activeDate || '2026-11-01',
      category,
      description: description.trim(),
      amount: numericAmount,
    });
    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-4">
      {/* Cabecera de Período + 4 KPIs Principales */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Caja, Recibos y Rendimiento por Período
              </h2>
              <p className="text-xs text-slate-500">
                Período activo:{' '}
                <span className="font-semibold text-slate-800">
                  {periodLabel}
                </span>{' '}
                · {filteredInvoices.length} cortes ({summary.totalSqmCut.toLocaleString('es-AR')} m²)
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filtrar caja por período"
            className="flex flex-wrap items-center gap-1"
          >
            {(
              [
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: '7 Días' },
                { id: 'mes_actual', label: 'Últimos 30 Días' },
                { id: 'mes_anterior', label: 'Mes Anterior' },
                { id: 'trimestre', label: 'Trimestre' },
                { id: 'anio', label: 'Año' },
                { id: 'personalizado', label: 'Fechas' },
              ] as { id: PeriodFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  period === item.id
                    ? 'bg-[#0B2219] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'personalizado' && (
          <div className="flex flex-wrap items-center gap-3 pb-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Desde:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Hasta:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
        )}

        {/* 4 KPI Cards (Máximo 4 por fila siguiendo estándares de legibilidad) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-xs font-medium text-slate-500">
              Cobrado en Mano / Banco
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tabular-nums mt-0.5">
              ${summary.totalCobrado.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Total facturado: ${summary.totalFacturado.toLocaleString('es-AR')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-xs font-medium text-slate-500">
              Ganancia Limpia de Bolsillo
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-0.5">
              ${summary.gananciaNeta.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-emerald-700 font-semibold mt-0.5">
              Margen libre: {summary.margenPorcentaje}% · Prom: $
              {summary.averageTicket.toLocaleString('es-AR')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-xs font-medium text-slate-500">
              Gastos (Nafta, Tanza, Insumos)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums mt-0.5">
              ${summary.totalGastos.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {filteredExpenses.length} gastos registrados
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <div className="text-xs font-medium text-slate-500">
              Por Cobrar (Cuenta Corriente)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700 tabular-nums mt-0.5">
              ${summary.porCobrar.toLocaleString('es-AR')}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {filteredInvoices.filter((i) => i.status === 'Pendiente').length}{' '}
              recibos pendientes
            </div>
          </div>
        </div>

        {/* Selector de Vista Interna (Progressive Disclosure: Recibos vs Gastos vs Estadísticas) */}
        <div
          role="tablist"
          aria-label="Vistas de Caja y Estadísticas"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'recibos'}
            onClick={() => setBillingSection('recibos')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              billingSection === 'recibos'
                ? 'bg-[#0B2219] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Recibos y Cobros ({filteredInvoices.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'gastos'}
            onClick={() => setBillingSection('gastos')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              billingSection === 'gastos'
                ? 'bg-[#0B2219] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>2. Gastos de Caja ({filteredExpenses.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'estadisticas'}
            onClick={() => setBillingSection('estadisticas')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              billingSection === 'estadisticas'
                ? 'bg-[#0B2219] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. Estadísticas por Mes y Zona</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: RECIBOS Y COBROS EMITIDOS */}
      {billingSection === 'recibos' && (
        <div className="surface-card rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Comprobantes y Cobros ({visibleInvoices.length} de{' '}
                {filteredInvoices.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toca «Editar» para corregir cualquier monto o fecha, o toca el nombre del cliente para ver sus cobros anteriores.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar cliente, calle o recibo..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
              />
              <select
                aria-label="Filtrar comprobantes por estado"
                value={invoiceStatusFilter}
                onChange={(e) =>
                  setInvoiceStatusFilter(
                    e.target.value as 'todos' | 'Pagado' | 'Pendiente'
                  )
                }
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-semibold"
              >
                <option value="todos">Todos los estados</option>
                <option value="Pagado">Solo Pagados</option>
                <option value="Pendiente">Solo Pendientes</option>
              </select>
            </div>
          </div>

          {visibleInvoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No hay recibos emitidos con ese filtro dentro del período seleccionado ({periodLabel}).
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleInvoices.map((inv) => {
                const cleanPhone = inv.phone.replace(/[^0-9]/g, '');
                const reminderMsg = `Hola ${inv.clientName}! Te recuerdo el saldo pendiente de $${inv.amount.toLocaleString('es-AR')} por el corte de pasto en ${inv.address} (${inv.date}). ¡Muchas gracias!`;
                const reminderUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  reminderMsg
                )}`;
                const matchingProp = properties.find(
                  (p) => p.id === inv.propertyId
                );

                return (
                  <div
                    key={inv.id}
                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-slate-300">·</span>
                        {matchingProp ? (
                          <button
                            type="button"
                            onClick={() => onViewClientHistory(matchingProp)}
                            className="font-bold text-sm text-slate-900 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{inv.clientName}</span>
                            <History className="w-3.5 h-3.5 text-emerald-700" />
                          </button>
                        ) : (
                          <span className="font-semibold text-sm text-slate-900">
                            {inv.clientName}
                          </span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            inv.status === 'Pagado'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {inv.status}
                          {inv.paymentMethod ? ` (${inv.paymentMethod})` : ''}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 break-words">
                        <span>
                          {inv.address} · {inv.neighborhood || 'Zona Centro'} ·{' '}
                          {inv.propertyType} ({inv.areaSqm} m²) · Fecha:{' '}
                          <span className="font-mono">{inv.date}</span>
                        </span>
                        {inv.actualDurationMinutes && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-semibold">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{inv.actualDurationMinutes} min</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                      <div className="text-right font-mono font-bold text-base text-slate-900 tabular-nums mr-1">
                        ${inv.amount.toLocaleString('es-AR')}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleInvoicePaid(inv.id)}
                        className={`min-h-[36px] px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
                          inv.status === 'Pendiente'
                            ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {inv.status === 'Pendiente'
                          ? 'Marcar Cobrado'
                          : 'Pasar a Pendiente'}
                      </button>

                      {inv.status === 'Pendiente' && (
                        <a
                          href={reminderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Recordar Pago</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectInvoiceReceipt(inv)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Recibo / Imprimir</span>
                      </button>

                      {onEditInvoice && (
                        <button
                          type="button"
                          onClick={() => onEditInvoice(inv)}
                          title="Editar monto, fecha o datos del recibo"
                          aria-label={`Editar recibo ${inv.invoiceNumber}`}
                          className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(inv.id)}
                        title="Eliminar recibo"
                        aria-label={`Eliminar recibo ${inv.invoiceNumber}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: GASTOS OPERATIVOS (NAFTA, TANZA, REPUESTOS, JORNAL) */}
      {billingSection === 'gastos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 surface-card rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Registrar o Editar Gasto Operativo
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Anota nafta, aceite 2T, tanza o repuestos para calcular tu ganancia limpia real.
              </p>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3">
              {editingExpenseId && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-900">
                  <span>Editando gasto seleccionado</span>
                  <button
                    type="button"
                    onClick={handleCancelEditExpense}
                    className="text-emerald-800 underline font-bold"
                  >
                    Cancelar edición
                  </button>
                </div>
              )}
              <div>
                <label
                  htmlFor="expense-category"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rubro del Gasto
                </label>
                <select
                  id="expense-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as OperationalExpense['category']
                    )
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="Combustible y Aceite 2T">
                    Combustible y Aceite 2T
                  </option>
                  <option value="Tanza y Cuchillas">
                    Tanza, Carreteles y Cuchillas
                  </option>
                  <option value="Mantenimiento Equipos">
                    Mantenimiento / Bujías / Filtros
                  </option>
                  <option value="Ayudante / Jornal">
                    Pago a Ayudante / Jornal
                  </option>
                  <option value="Traslado / Peajes">
                    Gasoil Camioneta / Viajes a Pueblos
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="expense-desc"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Detalle
                  </label>
                  <input
                    id="expense-desc"
                    type="text"
                    placeholder="Ej. 10L Nafta YPF + Aceite 2T"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor="expense-amount"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Monto ($)
                  </label>
                  <input
                    id="expense-amount"
                    type="number"
                    placeholder="16500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label
                    htmlFor="expense-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Fecha
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-mono tabular-nums"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`min-h-[42px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-xl transition-colors ${
                  editingExpenseId
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-[#0B2219] hover:bg-emerald-950'
                }`}
              >
                <Fuel className="w-3.5 h-3.5" />
                <span>
                  {editingExpenseId
                    ? 'Guardar Cambios del Gasto'
                    : 'Registrar Gasto Operativo'}
                </span>
              </button>
            </form>

            <div className="divide-y divide-slate-200 pt-2">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`py-3 flex items-center justify-between gap-2 text-xs ${
                    editingExpenseId === exp.id
                      ? 'bg-emerald-50/70 px-2.5 rounded-xl'
                      : ''
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {exp.description}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {exp.category} ·{' '}
                      <span className="font-mono">{exp.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="font-mono font-bold text-slate-900 tabular-nums mr-1">
                      -${exp.amount.toLocaleString('es-AR')}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartEditExpense(exp)}
                      title="Editar gasto"
                      aria-label={`Editar gasto ${exp.description}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(exp.id)}
                      title="Eliminar gasto"
                      aria-label={`Eliminar gasto ${exp.description}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 surface-card rounded-2xl p-4 sm:p-5 space-y-3 h-fit">
            <div className="border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                Estructura de Gastos por Rubro
              </h3>
              <p className="text-xs text-slate-500">
                Distribución acumulada de insumos, combustible y traslados
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {detailedAnalytics.expensesByCategory.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {cat.category}
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      ${cat.amount.toLocaleString('es-AR')} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.max(4, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: ESTADÍSTICAS MES A MES, BARRIOS/PUEBLOS Y RANKING DE CLIENTES */}
      {billingSection === 'estadisticas' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 surface-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Comparativa Mes a Mes (Evolución de Ganancias)
                </h3>
                <p className="text-xs text-slate-500">
                  Control mensual de cuánto ingresó, cuánto se gastó y cuánto quedó limpio
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2 pr-3">Mes</th>
                      <th className="py-2 px-2 text-right">Cortes · m²</th>
                      <th className="py-2 px-2 text-right">Facturado</th>
                      <th className="py-2 px-2 text-right">Gastos</th>
                      <th className="py-2 pl-2 text-right">Ganancia Limpia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {detailedAnalytics.monthlyBreakdown.map((m) => (
                      <tr key={m.monthKey} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-sans font-semibold text-slate-900">
                          {m.monthLabel}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600">
                          {m.cutsCount} ({m.totalSqm} m²)
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-slate-900">
                          ${m.facturado.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 px-2 text-right text-red-700">
                          -${m.gastos.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-bold text-emerald-700">
                          ${m.gananciaNeta.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 surface-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Ingresos por Barrio, Zona y Localidad
                </h3>
                <p className="text-xs text-slate-500">
                  Rentabilidad comparativa por zona de cobertura operativa
                </p>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {detailedAnalytics.localityBreakdown.map((loc) => (
                  <div
                    key={loc.locality}
                    className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200/80"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{loc.locality}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {loc.cutsCount} cortes ·{' '}
                        {loc.totalSqm.toLocaleString('es-AR')} m² trabajados
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                      ${loc.totalBilled.toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                Ranking de Clientes e Historial de Tarifas Cobradas
              </h3>
              <p className="text-xs text-slate-500">
                Compara cuánto le cobraste la última vez vs. la visita anterior a cada cliente
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-2 pr-2">Cliente</th>
                    <th className="py-2 px-2 text-right">Cortes</th>
                    <th className="py-2 px-2 text-right">Cobro Anterior</th>
                    <th className="py-2 px-2 text-right">Último Cobro</th>
                    <th className="py-2 pl-2 text-right">Total Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {detailedAnalytics.clientRanking.slice(0, 8).map((item) => {
                    const matchingProp = properties.find(
                      (p) => p.id === item.propertyId
                    );
                    const history = getClientPriceHistory(
                      item.propertyId,
                      item.clientName,
                      invoices
                    );
                    return (
                      <tr key={item.propertyId} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2 font-sans">
                          {matchingProp ? (
                            <button
                              type="button"
                              onClick={() => onViewClientHistory(matchingProp)}
                              className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                            >
                              {item.clientName}
                            </button>
                          ) : (
                            <span className="font-semibold text-slate-900">
                              {item.clientName}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {item.locality}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600">
                          {item.cutsCount}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500">
                          {history.previousAmount
                            ? `$${history.previousAmount.toLocaleString('es-AR')}`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-emerald-700">
                          ${item.lastAmount.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-bold text-slate-900">
                          ${item.totalBilled.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BackupAndEquipmentViewProps {
  properties?: ClientProperty[];
  invoices?: InvoiceRecord[];
  expenses?: OperationalExpense[];
  equipment: EquipmentItem[];
  googleUserEmail: string | null;
  connectedSpreadsheetId: string;
  connectedSpreadsheetUrl: string;
  lastSyncedAt: string | null;
  isSyncingSheets: boolean;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onSetSpreadsheetIdInput: (idOrUrl: string) => void;
  onRequestCreateGoogleSheet: () => void;
  onRequestSyncGoogleSheet: () => void;
  onLogEquipmentHours: (equipmentId: string, hours: number) => void;
  onResetEquipmentService: (equipmentId: string) => void;
  onAddEquipment: (item: Omit<EquipmentItem, 'id'>) => void;
  onUpdateEquipment?: (item: EquipmentItem) => void;
  onDeleteEquipment: (equipmentId: string) => void;
  onExportCsv: () => void;
  onCopyGoogleSheetsTsv: () => void;
  onExportJsonBackup: () => void;
  onImportJsonBackup: (file: File) => void;
  onRequestClearAllData: () => void;
  onRestoreDemoData: () => void;
}

export function BackupAndEquipmentView({
  equipment,
  googleUserEmail,
  connectedSpreadsheetId,
  connectedSpreadsheetUrl,
  lastSyncedAt,
  isSyncingSheets,
  onGoogleLogin,
  onGoogleLogout,
  onSetSpreadsheetIdInput,
  onRequestCreateGoogleSheet,
  onRequestSyncGoogleSheet,
  onLogEquipmentHours,
  onResetEquipmentService,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onExportCsv,
  onCopyGoogleSheetsTsv,
  onExportJsonBackup,
  onImportJsonBackup,
  onRequestClearAllData,
  onRestoreDemoData,
}: BackupAndEquipmentViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineModel, setNewMachineModel] = useState('');
  const [newMachineType, setNewMachineType] = useState<EquipmentItem['type']>(
    'Desmalezadora / Bordeadora'
  );
  const [newMachineLimit, setNewMachineLimit] = useState('25');

  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(
    null
  );
  const [editEqName, setEditEqName] = useState('');
  const [editEqModel, setEditEqModel] = useState('');
  const [editEqType, setEditEqType] = useState<EquipmentItem['type']>(
    'Desmalezadora / Bordeadora'
  );
  const [editEqHours, setEditEqHours] = useState('0');
  const [editEqLimit, setEditEqLimit] = useState('25');
  const [editEqTask, setEditEqTask] = useState('');

  const handleStartEditEquipment = (item: EquipmentItem) => {
    setEditingEquipmentId(item.id);
    setEditEqName(item.name);
    setEditEqModel(item.model);
    setEditEqType(item.type);
    setEditEqHours(String(item.hoursUsed));
    setEditEqLimit(String(item.serviceLimitHours));
    setEditEqTask(item.nextTask);
  };

  const handleSaveEditEquipment = (item: EquipmentItem) => {
    if (onUpdateEquipment) {
      onUpdateEquipment({
        ...item,
        name: editEqName.trim() || item.name,
        model: editEqModel.trim() || item.model,
        type: editEqType,
        hoursUsed: Math.max(0, Number(editEqHours) || 0),
        serviceLimitHours: Math.max(5, Number(editEqLimit) || 25),
        nextTask: editEqTask.trim() || item.nextTask,
      });
    }
    setEditingEquipmentId(null);
  };

  const handleCreateMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim()) return;
    onAddEquipment({
      name: newMachineName.trim(),
      model: newMachineModel.trim() || 'Uso Profesional',
      type: newMachineType,
      hoursUsed: 0,
      serviceLimitHours: Math.max(5, Number(newMachineLimit) || 25),
      nextTask: 'Afilado de cuchilla / Limpieza de filtro de aire y bujía',
      lastServiceDate: '2026-11-01',
    });
    setNewMachineName('');
    setNewMachineModel('');
  };

  return (
    <div className="space-y-6">
      {/* CONEXIÓN DIRECTA CON GOOGLE SHEETS (SIN DESCARGAR ARCHIVOS) */}
      <div className="bg-white border border-emerald-300 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-slate-900">
                Sincronización Directa con Google Sheets (En la Nube)
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Conecta tu cuenta de Google para crear y actualizar tu hoja de cálculo automáticamente sin tener que descargar ni subir archivos cada vez.
            </p>
          </div>

          {googleUserEmail ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                Conectado: {googleUserEmail}
              </span>
              <button
                type="button"
                onClick={onGoogleLogout}
                title="Desconectar cuenta de Google"
                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleLogin}
              className="min-h-[42px] inline-flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs text-xs font-semibold text-slate-800 transition-colors shrink-0"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-4 h-4 block"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>Sign in with Google (Conectar Google Sheets)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 space-y-2">
            <label
              htmlFor="sheet-id-input"
              className="block text-xs font-semibold text-slate-700"
            >
              ID o Enlace de tu Planilla de Google Sheets (se completa solo al crearla)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="sheet-id-input"
                type="text"
                placeholder="Pega el link o ID de tu Google Sheet, o toca 'Crear Nueva Planilla'"
                value={connectedSpreadsheetId}
                onChange={(e) => onSetSpreadsheetIdInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {connectedSpreadsheetUrl && (
                <a
                  href={connectedSpreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Google Sheet</span>
                </a>
              )}
            </div>
            {lastSyncedAt && (
              <p className="text-[11px] text-emerald-700 font-mono">
                ✓ Última actualización en Google Sheets: {lastSyncedAt}
              </p>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              disabled={isSyncingSheets}
              onClick={onRequestCreateGoogleSheet}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Planilla en mi Drive</span>
            </button>

            <button
              type="button"
              disabled={isSyncingSheets || !connectedSpreadsheetId.trim()}
              onClick={onRequestSyncGoogleSheet}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncingSheets ? 'animate-spin' : ''}`}
              />
              <span>
                {isSyncingSheets
                  ? 'Sincronizando...'
                  : 'Actualizar Google Sheet Ahora'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Opciones Adicionales: CSV, Copiar/Pegar y Pasar por WhatsApp */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Respaldo Offline y Transferencia por WhatsApp
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Además de Google Sheets en vivo, puedes descargar copias locales o limpiar los datos de prueba
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-900">
                1. Descargar Excel (.CSV) o Copiar Tabla
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Por si prefieres abrir el archivo en Excel en la computadora o pegar las celdas manualmente.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onExportCsv}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Planilla (.CSV)</span>
              </button>
              <button
                type="button"
                onClick={onCopyGoogleSheetsTsv}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                <ClipboardCopy className="w-4 h-4" />
                <span>Copiar Tabla al Portapapeles</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-900">
                2. Pasar Base Completa por WhatsApp (.JSON)
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Descarga la copia completa con clientes, recibos, máquinas y nombre del emprendimiento.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onExportJsonBackup}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                <Download className="w-4 h-4" />
                <span>Guardar Copia Completa (.JSON)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportJsonBackup(file);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Respaldo (.JSON)</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-slate-900">
                3. Empezar de Cero o Restaurar Demo
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Limpia los datos de demostración de Venado Tuerto cuando quieran empezar a cargar solo sus clientes reales.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={onRequestClearAllData}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vaciar Datos de Ejemplo (Dejar en 0)</span>
              </button>
              <button
                type="button"
                onClick={onRestoreDemoData}
                className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar Datos de Demostración</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de Maquinaria (100% Editable) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Control de Desgaste de Máquinas (Afilado de Cuchillas y Service)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registra horas de uso o toca &ldquo;Editar&rdquo; en cualquier máquina para ajustar su nombre, modelo, horas actuales o próximo mantenimiento
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {equipment.map((item) => {
            const ratio = Math.min(
              100,
              Math.round((item.hoursUsed / item.serviceLimitHours) * 100)
            );
            const needsService = item.hoursUsed >= item.serviceLimitHours * 0.85;
            const isEditingThis = editingEquipmentId === item.id;

            return (
              <div
                key={item.id}
                className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                {isEditingThis ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="font-bold text-emerald-800">
                      Editar Máquina
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">
                        Nombre de la máquina
                      </label>
                      <input
                        type="text"
                        aria-label="Editar nombre de máquina"
                        value={editEqName}
                        onChange={(e) => setEditEqName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">
                          Horas uso
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          aria-label="Editar horas usadas"
                          value={editEqHours}
                          onChange={(e) => setEditEqHours(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-0.5">
                          Límite service (h)
                        </label>
                        <input
                          type="number"
                          min="5"
                          aria-label="Editar límite de horas para service"
                          value={editEqLimit}
                          onChange={(e) => setEditEqLimit(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-0.5">
                        Próximo mantenimiento
                      </label>
                      <input
                        type="text"
                        aria-label="Editar próxima tarea de mantenimiento"
                        value={editEqTask}
                        onChange={(e) => setEditEqTask(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingEquipmentId(null)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditEquipment(item)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-slate-900">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.type} · {item.model}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditEquipment(item)}
                            title="Editar máquina"
                            aria-label={`Editar máquina ${item.name}`}
                            className="p-1 text-slate-500 hover:text-emerald-700 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEquipment(item.id)}
                            title="Eliminar máquina"
                            aria-label={`Eliminar máquina ${item.name}`}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-slate-600">Uso actual:</span>
                          <span
                            className={`font-bold ${
                              needsService ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {item.hoursUsed}h / {item.serviceLimitHours}h
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              needsService ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Próximo service:
                        </span>{' '}
                        {item.nextTask}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onLogEquipmentHours(item.id, 1)}
                        className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                      >
                        +1h Uso
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetEquipmentService(item.id)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Service (0h)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleCreateMachine}
          className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Agregar Máquina / Herramienta
            </label>
            <input
              type="text"
              placeholder="Ej. Motoguadaña Echo SRM-4605"
              value={newMachineName}
              onChange={(e) => setNewMachineName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Tipo
            </label>
            <select
              value={newMachineType}
              onChange={(e) =>
                setNewMachineType(e.target.value as EquipmentItem['type'])
              }
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="Desmalezadora / Bordeadora">Desmalezadora</option>
              <option value="Cortadora Autopropulsada">Cortadora Empuje</option>
              <option value="Tractor Cortacésped">Tractor / Giro Cero</option>
              <option value="Sopladora">Sopladora</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Service cada (hs)
            </label>
            <input
              type="number"
              min={5}
              max={200}
              value={newMachineLimit}
              onChange={(e) => setNewMachineLimit(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sumar Máquina</span>
          </button>
        </form>
      </div>
    </div>
  );
}
