import React, { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calculator,
  Calendar,
  Camera,
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
  Volume2,
  Wallet,
  Wrench,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  BusinessProfileConfig,
  ClientProperty,
  CutFrequency,
  EquipmentItem,
  GrassCondition,
  InvoiceRecord,
  JobPhotoItem,
  OperationalExpense,
  PeriodFilter,
  PropertyType,
  ScheduledJob,
} from '../types/lawn';
import {
  BillingGalleryStageFilter,
  calculateDualTierQuote,
  calculateFinancialSummary,
  calculateSuggestedPrice,
  collectBillingBeforeAfterGallery,
  computeDetailedAnalytics,
  extractInvoicePhotoItems,
  filterRecordsByPeriod,
  getClientBeforeAfterGallery,
  getClientCutTimeHistory,
  getClientPriceHistory,
  getOverdueClientsForCut,
  getTodayIsoLocal,
} from '../utils/lawnLogic';
import {
  buildSpokenClientSummary,
  buildSpokenFinanceSummary,
  speakTextAloud,
} from '../utils/voiceAccessibility';
import { NEIGHBORHOOD_COORDINATES } from '../data/seedData';
import { StreetAddressAutocomplete } from './StreetAddressAutocomplete';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ClientsViewProps {
  properties: ClientProperty[];
  todayJobs: ScheduledJob[];
  invoices: InvoiceRecord[];
  paymentAlias?: string;
  isEasyAccessMode?: boolean;
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
  isEasyAccessMode = false,
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
  const [filterBalance, setFilterBalance] = useState<'todos' | 'con_deuda' | 'vencidos'>('todos');
  const [sortBy, setSortBy] = useState<'nombre' | 'tarifa_mayor' | 'proximo_corte'>('nombre');
  const [onlyOutdated, setOnlyOutdated] = useState<boolean>(false);

  const todayIso = useMemo(() => getTodayIsoLocal(), []);
  const overdueAlerts = useMemo(
    () => getOverdueClientsForCut(properties, todayIso, todayJobs),
    [properties, todayIso, todayJobs]
  );
  const overduePropertyIds = useMemo(
    () => new Set(overdueAlerts.map((a) => a.property.id)),
    [overdueAlerts]
  );

  const availableZones = useMemo(() => {
    const zones = Array.from(
      new Set(
        properties
          .map((p) => (p.neighborhood || '').trim())
          .filter((z) => z.length > 0)
      )
    );
    return zones.sort((a, b) => a.localeCompare(b, 'es'));
  }, [properties]);

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
        (prop.neighborhood || '').toLowerCase() === filterZone.toLowerCase();

      if (!matchesSearch || !matchesType || !matchesZone) return false;

      if (filterBalance === 'con_deuda') {
        const history = getClientPriceHistory(prop.id, prop.clientName, invoices);
        return history.pendingBalance > 0;
      }
      if (filterBalance === 'vencidos') {
        return overduePropertyIds.has(prop.id);
      }
      return true;
    });

    return [...matching].sort((a, b) => {
      if (sortBy === 'tarifa_mayor') return b.basePrice - a.basePrice;
      if (sortBy === 'proximo_corte') return a.nextCutDate.localeCompare(b.nextCutDate);
      return a.clientName.localeCompare(b.clientName, 'es');
    });
  }, [
    properties,
    searchQuery,
    filterType,
    filterZone,
    filterBalance,
    sortBy,
    invoices,
    overduePropertyIds,
  ]);

  const portfolioKpis = useMemo(() => {
    const totalSqm = properties.reduce((acc, p) => acc + (p.areaSqm || 0), 0);
    const totalBaseRevenue = properties.reduce((acc, p) => acc + (p.basePrice || 0), 0);
    const totalPendingReceivables = invoices
      .filter((inv) => inv.status === 'Pendiente')
      .reduce((acc, inv) => acc + inv.amount, 0);
    const overduePotentialRevenue = overdueAlerts.reduce(
      (acc, a) => acc + (a.property.basePrice || 0),
      0
    );
    return {
      totalClients: properties.length,
      totalSqm,
      totalBaseRevenue,
      totalPendingReceivables,
      overduePotentialRevenue,
    };
  }, [properties, invoices, overdueAlerts]);

  return (
    <div className="space-y-8">
      {/* STRATEGIC BENTO ROW 1: PORTFOLIO METRICS (8 COLS) + QUICK ACTIONS & TARIFFS (4 COLS) */}
      <section
        aria-label="Resumen de Cartera y Acciones Estratégicas"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        {/* BENTO TILE 1: CORE PORTFOLIO TELEMETRY (UNBOXED METRICS WITH HAIRLINE DIVIDERS) */}
        <div className="lg:col-span-8 bento-tile rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700">
                CRM y Cartera Activa
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                Gestión de Clientes y Propiedades
              </h2>
            </div>

            <button
              type="button"
              onClick={onOpenNewClient}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl whitespace-nowrap cursor-pointer shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Nuevo Cliente</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x divide-slate-100 pt-4 border-t border-slate-100">
            <div className="sm:pr-6">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Propiedades Activas
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
                {portfolioKpis.totalClients}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {portfolioKpis.totalSqm.toLocaleString('es-AR')} m² totales
              </div>
            </div>

            <div className="sm:px-6">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Potencial por Ciclo
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
                ${portfolioKpis.totalBaseRevenue.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Suma de abonos y tarifas base
              </div>
            </div>

            <div
              data-testid="overdue-cuts-radar"
              className="sm:pl-6"
            >
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                Por Cobrar en Calle
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
                ${portfolioKpis.totalPendingReceivables.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {overdueAlerts.length > 0
                  ? `${overdueAlerts.length} lotes en fecha de corte`
                  : 'Agenda de cortes al día'}
              </div>
            </div>
          </div>
        </div>

        {/* BENTO TILE 2: STRATEGIC TARIFF & AGENDA CONTROL */}
        <div className="lg:col-span-4 bento-tile rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-400">
              Herramientas de Cartera
            </span>
            <h3 className="font-display text-base font-bold text-slate-900">
              Actualización Tarifaria y Radar
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ajustá los precios base de toda tu cartera o filtrá rápidamente los lotes que ya cumplieron su ciclo.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            {onBulkUpdatePrices && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">
                  Ajuste general:
                </span>
                <div className="flex items-center gap-2">
                  {[10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onBulkUpdatePrices(pct, false)}
                      title={`Aumentar tarifas un ${pct}%`}
                      className="min-h-[34px] px-3 py-1.5 text-xs font-mono font-semibold bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 rounded-xl cursor-pointer transition-colors"
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setFilterBalance((prev) =>
                  prev === 'vencidos' ? 'todos' : 'vencidos'
                )
              }
              className={`min-h-[38px] w-full inline-flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                filterBalance === 'vencidos'
                  ? 'bg-slate-900 text-white'
                  : 'bg-emerald-50/80 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>Ver lotes pendientes de agendar</span>
              <span className="font-mono font-bold">
                {overdueAlerts.length}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* STRATEGIC BENTO ROW 2: CLIENT DIRECTORY & SEARCH */}
      <section
        aria-label="Directorio de Clientes"
        className="bento-tile rounded-2xl overflow-hidden"
      >
        {/* Spacious Search & Filter Toolbar */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white">
          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, dirección o barrio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl">
              {(
                [
                  { id: 'todos', label: `Todos (${properties.length})` },
                  {
                    id: 'vencidos',
                    label: `Por agendar (${overdueAlerts.length})`,
                  },
                  { id: 'con_deuda', label: 'Con saldo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterBalance(tab.id)}
                  className={`min-h-[32px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    filterBalance === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filtrar por tipo de propiedad"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="min-h-[36px] px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium"
            >
              <option value="Todos">Todos los tipos</option>
              <option value="Casa">Casas</option>
              <option value="Terreno">Terrenos</option>
              <option value="Quinta">Quintas</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              No se encontraron clientes con ese criterio
            </p>
            <p className="text-xs text-slate-500">
              Limpiá el filtro de búsqueda o registrá un cliente nuevo con el botón superior.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Client List */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((prop) => {
                const alreadyInToday = todayJobs.some(
                  (j) => j.propertyId === prop.id
                );
                const history = getClientPriceHistory(
                  prop.id,
                  prop.clientName,
                  invoices
                );
                const cleanPhone = prop.phone.replace(/[^0-9]/g, '');

                return (
                  <div
                    key={prop.id}
                    className="p-5 space-y-3.5 min-w-0 bg-white"
                  >
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {prop.clientName}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {prop.address} · {prop.neighborhood}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                          {prop.propertyType} · {prop.areaSqm} m² · {prop.frequency}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                          ${prop.basePrice.toLocaleString('es-AR')}
                        </div>
                        {history.pendingBalance > 0 ? (
                          <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                            Debe ${history.pendingBalance.toLocaleString('es-AR')}
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                            Al día
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewClientHistory(prop)}
                          className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Ficha</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditClient(prop)}
                          className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WA</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onScheduleClient(prop)}
                          className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl"
                        >
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Agendar</span>
                        </button>

                        {alreadyInToday ? (
                          <span className="text-xs font-semibold text-emerald-600 px-2.5 py-1">
                            ✓ En Ruta
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAddPropertyToToday(prop)}
                            className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            <span>+ Hoy</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Spacious Client Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">Cliente</th>
                    <th className="py-4 px-6">Dirección y Superficie</th>
                    <th className="py-4 px-6">Ciclo y Último Servicio</th>
                    <th className="py-4 px-6 text-right">Tarifa Vigente</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((prop) => {
                    const alreadyInToday = todayJobs.some(
                      (j) => j.propertyId === prop.id
                    );
                    const history = getClientPriceHistory(
                      prop.id,
                      prop.clientName,
                      invoices
                    );
                    const cleanPhone = prop.phone.replace(/[^0-9]/g, '');

                    return (
                      <tr
                        key={prop.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-4 sm:py-5 px-6 align-middle">
                          <div className="font-bold text-slate-900">
                            {prop.clientName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2.5">
                            <span>{prop.phone}</span>
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline font-sans font-medium"
                            >
                              WhatsApp
                            </a>
                          </div>
                        </td>
                        <td className="py-4 sm:py-5 px-6 align-middle">
                          <div className="text-slate-900 font-medium">
                            {prop.address}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {prop.neighborhood} · {prop.propertyType} ({prop.areaSqm} m²)
                          </div>
                        </td>
                        <td className="py-4 sm:py-5 px-6 align-middle">
                          <div className="text-xs font-semibold text-slate-800">
                            {prop.frequency} · Próx: {prop.nextCutDate}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {history.lastAmount ? (
                              <span>
                                Último: ${history.lastAmount.toLocaleString('es-AR')} ({history.lastDate})
                              </span>
                            ) : (
                              <span>Sin cobros registrados</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 sm:py-5 px-6 align-middle text-right font-mono tabular-nums">
                          <div className="font-bold text-base text-slate-900">
                            ${prop.basePrice.toLocaleString('es-AR')}
                          </div>
                          {history.pendingBalance > 0 ? (
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <span className="text-xs font-semibold text-amber-700">
                                Debe ${history.pendingBalance.toLocaleString('es-AR')}
                              </span>
                              {onSettleClientPendingInvoices && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSettleClientPendingInvoices(prop.id)
                                  }
                                  className="px-2 py-0.5 text-[10px] font-sans font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                                >
                                  Saldar
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-600 font-sans font-medium mt-1">
                              Al día
                            </div>
                          )}
                        </td>
                        <td className="py-4 sm:py-5 px-6 align-middle text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onScheduleClient(prop)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Agendar
                            </button>

                            {alreadyInToday ? (
                              <span className="text-xs font-semibold text-emerald-600 px-2.5 py-1.5 whitespace-nowrap">
                                ✓ En Ruta
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAddPropertyToToday(prop)}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                              >
                                + Hoy
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onViewClientHistory(prop)}
                              title="Ver ficha e historial"
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onEditClient(prop)}
                              title="Editar cliente"
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onRequestDeleteClient(prop)}
                              title="Eliminar cliente"
                              aria-label={`Eliminar ${prop.clientName}`}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
          </>
        )}
      </section>
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

  const [quoteProposalMode, setQuoteProposalMode] = useState<'doble' | 'simple'>(
    'doble'
  );

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

  const dualTierQuote = useMemo(
    () =>
      calculateDualTierQuote({
        areaSqm: computedSqm,
        propertyType,
        grassCondition,
        includesBagging,
        extraTasksCount,
        travelFee: parsedTravelFee,
        baseRatePerSqm: businessProfile?.baseRatePerSqm,
        minServicePrice: businessProfile?.minServicePrice,
      }),
    [
      computedSqm,
      propertyType,
      grassCondition,
      includesBagging,
      extraTasksCount,
      parsedTravelFee,
      businessProfile,
    ]
  );

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
  const whatsappQuoteMessage =
    quoteProposalMode === 'doble'
      ? `Hola${
          prospectName ? ` ${prospectName}` : ''
        }! Te paso el presupuesto de ${brandSignature} para corte y mantenimiento en ${selectedTown}${
          prospectAddress ? ` (${prospectAddress})` : ''
        } (${computedSqm} m² · ${propertyType}):

✅ OPCIÓN 1 — Corte Único / Limpieza Inicial: $${dualTierQuote.singleCutPrice.toLocaleString('es-AR')}
✅ OPCIÓN 2 — Abono Mantenimiento Quincenal: $${dualTierQuote.biweeklyCutPrice.toLocaleString('es-AR')} por visita (Ahorrás $${dualTierQuote.savingsPerCutForClient.toLocaleString('es-AR')} en cada corte y el lote se mantiene siempre prolijo).

• Incluye: Corte completo, bordeado perimetral${
          includesBagging ? ' y embolsado final' : ' y soplado de vereda'
        }.
• Tiempo estimado de trabajo: ~${baseQuote.estimatedMinutes} min.
Avisame cuál opción te queda mejor y coordinamos día y horario!`
      : `Hola${
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 bento-tile rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700">
              Ingeniería Comercial
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Cotizador de Servicios · {brandSignature}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Tarifa base: ${businessProfile?.baseRatePerSqm || 65}/m² · Mínimo: $
              {(businessProfile?.minServicePrice || 18000).toLocaleString('es-AR')}
            </p>
          </div>
          {onOpenBusinessProfile && (
            <button
              type="button"
              onClick={onOpenBusinessProfile}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Ajustar tarifa $/m²</span>
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
                Zona / Barrio
              </label>
              <select
                id="quote-town-select"
                value={selectedTown}
                onChange={(e) => handleTownChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                Adicional Traslado ($)
              </label>
              <input
                id="quote-travel-fee"
                type="number"
                min={0}
                step={500}
                value={travelFee}
                onChange={(e) => setTravelFee(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tabular-nums bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Superficie del lote
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setInputMode('dimensions')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    inputMode === 'dimensions'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Frente × Fondo
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('sqm')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    inputMode === 'sqm'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Metros m²
                </button>
              </div>
            </div>

            {inputMode === 'dimensions' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="quote-width"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    Frente (m)
                  </label>
                  <input
                    id="quote-width"
                    type="number"
                    min={2}
                    max={500}
                    value={widthMeters}
                    onChange={(e) => setWidthMeters(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="quote-length"
                    className="block text-[11px] text-slate-500 mb-1"
                  >
                    Fondo (m)
                  </label>
                  <input
                    id="quote-length"
                    type="number"
                    min={2}
                    max={500}
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="quote-sqm"
                  className="block text-[11px] text-slate-500 mb-1"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="quote-prop-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Propiedad
              </label>
              <select
                id="quote-prop-type"
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as PropertyType)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/60"
              >
                <option value="Casa">Casa con jardín</option>
                <option value="Terreno">Terreno / Lote</option>
                <option value="Quinta">Quinta / Parque</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quote-grass-cond"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Estado del Pasto
              </label>
              <select
                id="quote-grass-cond"
                value={grassCondition}
                onChange={(e) =>
                  setGrassCondition(e.target.value as GrassCondition)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/60"
              >
                <option value="Regular">Mantenido (&lt;12 cm)</option>
                <option value="Alto">Pasto Alto (+30%)</option>
                <option value="Maleza Pesada">Maleza Pesada (+65%)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quote-freq"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Frecuencia
              </label>
              <select
                id="quote-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as CutFrequency)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/60"
              >
                <option value="Semanal">Semanal (-10%)</option>
                <option value="Quincenal">Quincenal (Base)</option>
                <option value="Mensual">Mensual (+25%)</option>
                <option value="Única vez">Única vez (+35%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-2.5 border border-slate-200 rounded-lg bg-slate-50/60">
              <input
                type="checkbox"
                checked={includesBagging}
                onChange={(e) => setIncludesBagging(e.target.checked)}
                className="rounded border-slate-300 text-slate-900"
              />
              <span>Incluir embolsado de pasto</span>
            </label>

            <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50/60">
              <span className="text-xs font-medium text-slate-700">
                Tareas extra:
              </span>
              <select
                aria-label="Cantidad de tareas extra"
                value={extraTasksCount}
                onChange={(e) => setExtraTasksCount(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono"
              >
                <option value={0}>Sin extras</option>
                <option value={1}>+1 ($4.500)</option>
                <option value={2}>+2 ($9.000)</option>
                <option value={3}>+3 ($13.500)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-slate-700">
              Datos del cliente (opcional para enviar o agendar)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                placeholder="WhatsApp (Ej. 3462554433)"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
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
              placeholder="Dirección (Ej. Av. Casey 650, Mitre 1100...)"
            />
          </div>
        </div>
      </div>

      {/* Resultado del Presupuesto */}
      <div
        data-testid="dual-tier-quote-panel"
        className="lg:col-span-5 bento-tile text-slate-900 rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6"
      >
        <div className="space-y-5">
          <div className="border-b border-slate-100 pb-4 flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Valor Sugerido ({selectedTown})
              </span>
              <div className="font-display text-3xl font-extrabold font-mono text-slate-900 tabular-nums mt-0.5 tracking-tight">
                ${totalSuggestedPrice.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                {computedSqm} m² · ~${pricePerSqm}/m² · ~{baseQuote.estimatedMinutes} min
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold shrink-0">
              ${dualTierQuote.netHourlyProfitSingle.toLocaleString('es-AR')}/h
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                Formato de propuesta:
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuoteProposalMode('doble')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    quoteProposalMode === 'doble'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  Doble Opción
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteProposalMode('simple')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                    quoteProposalMode === 'simple'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600'
                  }`}
                >
                  Simple
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  1. Corte Inicial
                </div>
                <div className="font-display text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  ${dualTierQuote.singleCutPrice.toLocaleString('es-AR')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Pasto {grassCondition.toLowerCase()}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  2. Abono Quincenal
                </div>
                <div className="font-display text-lg font-bold font-mono text-emerald-700 tabular-nums mt-0.5">
                  ${dualTierQuote.biweeklyCutPrice.toLocaleString('es-AR')}
                  <span className="text-[10px] font-sans font-normal text-slate-500">
                    /corte
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Mensual: ${dualTierQuote.monthlyAbonoTotal.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Vista previa WhatsApp
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-mono max-h-40 overflow-y-auto">
              {whatsappQuoteMessage}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>Enviar Propuesta por WhatsApp</span>
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
            className="min-h-[40px] w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Convertir en Cliente Activo</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface BillingViewProps {
  activeDate?: string;
  isEasyAccessMode?: boolean;
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
  isEasyAccessMode = false,
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
    'recibos' | 'gastos' | 'estadisticas' | 'galeria'
  >('recibos');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<
    'todos' | 'Pagado' | 'Pendiente'
  >('todos');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [galleryStageFilter, setGalleryStageFilter] =
    useState<BillingGalleryStageFilter>('todos');
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<JobPhotoItem | null>(null);

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

  const billingGallery = useMemo(
    () =>
      collectBillingBeforeAfterGallery(
        invoices,
        properties,
        galleryStageFilter,
        gallerySearchQuery
      ),
    [invoices, properties, galleryStageFilter, gallerySearchQuery]
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
    <div className="space-y-8">
      {/* TOP UNBOXED CANVAS HEADER: TITLE + PERIOD SELECTOR (GENEROUS NEGATIVE SPACE) */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700">
            Tesorería y Rentabilidad
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Finanzas y Flujo de Caja
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Período activo:{' '}
            <span className="font-semibold text-slate-800">{periodLabel}</span> ·{' '}
            {filteredInvoices.length} comprobantes registrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filtrar caja por período"
            className="inline-flex flex-wrap items-center p-1 bg-white border border-slate-200/90 rounded-xl shadow-2xs gap-0.5"
          >
            {(
              [
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: '7 Días' },
                { id: 'mes_actual', label: '30 Días' },
                { id: 'mes_anterior', label: 'Mes Ant.' },
                { id: 'anio', label: 'Año' },
                { id: 'personalizado', label: 'Fechas' },
              ] as { id: PeriodFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  period === item.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isEasyAccessMode && (
            <button
              type="button"
              data-testid="speak-finance-summary-btn"
              onClick={() =>
                speakTextAloud(
                  buildSpokenFinanceSummary({
                    periodLabel,
                    totalCobrado: summary.totalCobrado,
                    totalGastos: summary.totalGastos,
                    gananciaNeta: summary.gananciaNeta,
                    porCobrar: summary.porCobrar,
                  })
                )
              }
              className="min-h-[36px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all cursor-pointer"
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>Escuchar Caja</span>
            </button>
          )}
        </div>
      </header>

      {period === 'personalizado' && (
        <div className="bento-tile rounded-2xl px-6 py-4 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Desde:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Hasta:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl font-mono"
            />
          </div>
        </div>
      )}

      {/* STRATEGIC BENTO ROW 1: ASYMMETRIC TREASURY ARCHITECTURE (ZERO NESTED CARDS) */}
      <section
        data-testid="finance-treasury-architecture"
        aria-label="Indicadores Principales de Tesorería"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        {/* BENTO TILE 1 (5 COLS): HERO NET PROFIT */}
        <div className="lg:col-span-5 bento-tile rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700">
              Ganancia Neta Libre
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
              Margen {summary.margenPorcentaje}%
            </span>
          </div>

          <div
            data-testid="net-profit-hero-value"
            className="font-display text-3xl sm:text-4xl font-bold font-mono tabular-nums text-slate-900 tracking-tight"
          >
            ${summary.gananciaNeta.toLocaleString('es-AR')}
          </div>

          <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Ingresos cobrados menos gastos operativos</span>
            <span className="font-mono font-semibold text-slate-700">
              {periodLabel}
            </span>
          </div>
        </div>

        {/* BENTO TILE 2 (7 COLS): UNBOXED 3-COLUMN CASHFLOW LEDGER */}
        <div
          data-testid="finance-stacked-ledger-rows"
          className="lg:col-span-7 bento-tile rounded-2xl p-6 sm:p-7 flex flex-col justify-center"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x divide-slate-100">
            <div className="sm:pr-6 flex flex-col justify-between">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                + Ingresos Cobrados
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                +${summary.totalCobrado.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
                Facturado: ${summary.totalFacturado.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="sm:px-6 flex flex-col justify-between">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                - Gastos Operativos
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
                -${summary.totalGastos.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                {filteredExpenses.length} egresos registrados
              </div>
            </div>

            <div className="sm:pl-6 flex flex-col justify-between">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-700">
                Por Cobrar en Calle
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold font-mono tabular-nums text-amber-700 mt-2">
                ${summary.porCobrar.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-slate-500 mt-1.5">
                {filteredInvoices.filter((i) => i.status === 'Pendiente').length}{' '}
                recibos pendientes
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STRATEGIC WORKSPACE NAVIGATION & BENTO CONTENT */}
      <div className="space-y-6">
        <div
          role="tablist"
          aria-label="Vistas de Finanzas, Gastos y Balance"
          className="inline-flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'recibos'}
            onClick={() => setBillingSection('recibos')}
            className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer ${
              billingSection === 'recibos'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Recibos y Cobros ({filteredInvoices.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'gastos'}
            onClick={() => setBillingSection('gastos')}
            className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer ${
              billingSection === 'gastos'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Fuel className="w-3.5 h-3.5 shrink-0" />
            <span>Gastos e Insumos ({filteredExpenses.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={billingSection === 'estadisticas'}
            onClick={() => setBillingSection('estadisticas')}
            className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer ${
              billingSection === 'estadisticas'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>Balance Mensual</span>
          </button>
        </div>

        {/* VISTA 1: RECIBOS Y COBROS EMITIDOS */}
        {billingSection === 'recibos' && (
          <div className="bento-tile rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Comprobantes Emitidos ({visibleInvoices.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control de recibos digitales, estado de cobro y envío por WhatsApp.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  placeholder="Buscar cliente o recibo..."
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-none focus:border-slate-900"
                />
                <select
                  aria-label="Filtrar comprobantes por estado"
                  value={invoiceStatusFilter}
                  onChange={(e) =>
                    setInvoiceStatusFilter(
                      e.target.value as 'todos' | 'Pagado' | 'Pendiente'
                    )
                  }
                  className="px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="Pagado">Pagados</option>
                  <option value="Pendiente">Pendientes</option>
                </select>
              </div>
            </div>

            {visibleInvoices.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No hay recibos emitidos con ese filtro dentro del período ({periodLabel}).
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleInvoices.map((inv) => {
                  const matchingProp = properties.find(
                    (p) => p.id === inv.propertyId
                  );

                  return (
                    <div
                      key={inv.id}
                      className="py-4 sm:py-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-slate-400">
                            {inv.invoiceNumber}
                          </span>
                          {matchingProp ? (
                            <button
                              type="button"
                              onClick={() => onViewClientHistory(matchingProp)}
                              className="font-bold text-sm text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer"
                            >
                              {inv.clientName}
                            </button>
                          ) : (
                            <span className="font-bold text-sm text-slate-900">
                              {inv.clientName}
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                              inv.status === 'Pagado'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                            }`}
                          >
                            {inv.status}
                            {inv.paymentMethod ? ` · ${inv.paymentMethod}` : ''}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 truncate">
                          {inv.address} · {inv.neighborhood || 'Zona Centro'} ·{' '}
                          <span className="font-mono">{inv.date}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0">
                        <div className="text-right font-mono font-bold text-base text-slate-900 tabular-nums mr-3">
                          ${inv.amount.toLocaleString('es-AR')}
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleInvoicePaid(inv.id)}
                          className={`min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                            inv.status === 'Pendiente'
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {inv.status === 'Pendiente'
                            ? 'Marcar Cobrado'
                            : 'Pasar a Pendiente'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectInvoiceReceipt(inv)}
                          className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Recibo</span>
                        </button>

                        {onEditInvoice && (
                          <button
                            type="button"
                            onClick={() => onEditInvoice(inv)}
                            title="Editar recibo"
                            aria-label={`Editar recibo ${inv.invoiceNumber}`}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteInvoice(inv.id)}
                          title="Eliminar recibo"
                          aria-label={`Eliminar recibo ${inv.invoiceNumber}`}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
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

        {/* VISTA 2: GASTOS OPERATIVOS */}
        {billingSection === 'gastos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bento-tile rounded-2xl p-6 sm:p-7 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Registrar Gasto Operativo
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Combustible, aceite 2T, tanza, cuchillas, repuestos o jornales.
                </p>
              </div>

              <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
                {editingExpenseId && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-900">
                    <span>Editando gasto seleccionado</span>
                    <button
                      type="button"
                      onClick={handleCancelEditExpense}
                      className="text-emerald-800 underline font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="expense-category"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Rubro
                    </label>
                    <select
                      id="expense-category"
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value as OperationalExpense['category']
                        )
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/70"
                    >
                      <option value="Combustible y Aceite 2T">
                        Combustible y Aceite 2T
                      </option>
                      <option value="Tanza y Cuchillas">
                        Tanza y Cuchillas
                      </option>
                      <option value="Mantenimiento Equipos">
                        Mantenimiento Equipos
                      </option>
                      <option value="Ayudante / Jornal">
                        Ayudante / Jornal
                      </option>
                      <option value="Traslado / Peajes">
                        Traslado / Peajes
                      </option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="expense-desc"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Detalle
                    </label>
                    <input
                      id="expense-desc"
                      type="text"
                      placeholder="Ej. 10L Nafta + Aceite"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="expense-amount"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Monto ($)
                    </label>
                    <input
                      id="expense-amount"
                      type="number"
                      placeholder="16500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="expense-date"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Fecha
                    </label>
                    <input
                      id="expense-date"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl font-mono tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[40px] w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors cursor-pointer bg-slate-900 hover:bg-slate-800"
                >
                  <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {editingExpenseId ? 'Guardar Cambios' : 'Registrar Gasto'}
                  </span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 pt-2">
                {filteredExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="py-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {exp.description}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {exp.category} · <span className="font-mono">{exp.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="font-mono font-bold text-sm text-slate-900 tabular-nums mr-1">
                        -${exp.amount.toLocaleString('es-AR')}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEditExpense(exp)}
                        title="Editar gasto"
                        aria-label={`Editar gasto ${exp.description}`}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        title="Eliminar gasto"
                        aria-label={`Eliminar gasto ${exp.description}`}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bento-tile rounded-2xl p-6 sm:p-7 space-y-5 h-fit">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Distribución de Gastos por Rubro
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Participación de cada insumo sobre la estructura de costos.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {detailedAnalytics.expensesByCategory.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {cat.category}
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        ${cat.amount.toLocaleString('es-AR')} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-full"
                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 3: BALANCE MENSUAL */}
        {billingSection === 'estadisticas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bento-tile rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Evolución Mensual de Ganancias
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparativa histórica entre facturación, egresos y ganancia libre.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-mono font-semibold uppercase text-[10px]">
                      <th className="py-3 pr-3">Mes</th>
                      <th className="py-3 px-2 text-right">Servicios</th>
                      <th className="py-3 px-2 text-right">Facturado</th>
                      <th className="py-3 px-2 text-right">Gastos</th>
                      <th className="py-3 pl-2 text-right">Ganancia Neta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {detailedAnalytics.monthlyBreakdown.map((m) => (
                      <tr key={m.monthKey} className="hover:bg-slate-50/60">
                        <td className="py-3.5 pr-3 font-sans font-semibold text-slate-900">
                          {m.monthLabel}
                        </td>
                        <td className="py-3.5 px-2 text-right text-slate-500">
                          {m.cutsCount}
                        </td>
                        <td className="py-3.5 px-2 text-right font-semibold text-slate-900">
                          ${m.facturado.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3.5 px-2 text-right text-slate-500">
                          -${m.gastos.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3.5 pl-2 text-right font-bold text-emerald-700">
                          ${m.gananciaNeta.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bento-tile rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Facturación por Zona
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rendimiento acumulado por barrio o localidad atendida.
                </p>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                {detailedAnalytics.localityBreakdown.map((loc) => (
                  <div
                    key={loc.locality}
                    className="flex items-center justify-between text-xs py-3.5"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {loc.locality}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {loc.cutsCount} servicios realizados
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
        )}
      </div>

      {/* VISOR LIGHTBOX DE EVIDENCIA FOTOGRÁFICA EN FACTURACIÓN */}
      {lightboxPhoto && (
        <div
          data-testid="billing-photo-lightbox"
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de evidencia fotográfica"
        >
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-2xl w-full p-4 space-y-3 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              <span className="font-bold text-sm">
                {lightboxPhoto.clientName} · {lightboxPhoto.address}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                aria-label="Cerrar vista ampliada"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || 'Foto del lote'}
              className="w-full max-h-[65vh] object-contain rounded-xl bg-black"
            />
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
    <div className="space-y-8">
      {/* 1. Control de Maquinaria (Strategic Bento Container) */}
      <div className="bento-tile rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700">
              Mantenimiento Preventivo
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Control de Maquinaria y Service ({equipment.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registrá horas de uso para controlar afilado de cuchillas, filtros y cambios de aceite.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                className="border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 bg-slate-50/40"
              >
                {isEditingThis ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-bold text-slate-900">
                      Editar Máquina
                    </div>
                    <input
                      type="text"
                      aria-label="Editar nombre de máquina"
                      value={editEqName}
                      onChange={(e) => setEditEqName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">
                          Horas uso
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          aria-label="Editar horas usadas"
                          value={editEqHours}
                          onChange={(e) => setEditEqHours(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">
                          Límite (h)
                        </label>
                        <input
                          type="number"
                          min="5"
                          aria-label="Editar límite de horas para service"
                          value={editEqLimit}
                          onChange={(e) => setEditEqLimit(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg font-mono text-xs bg-white"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      aria-label="Editar próxima tarea de mantenimiento"
                      value={editEqTask}
                      onChange={(e) => setEditEqTask(e.target.value)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingEquipmentId(null)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditEquipment(item)}
                        className="px-3 py-1 text-xs font-bold text-white bg-slate-900 rounded-lg"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {item.type}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditEquipment(item)}
                            title="Editar máquina"
                            aria-label={`Editar máquina ${item.name}`}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
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
                          <span className="text-slate-500">Uso:</span>
                          <span
                            className={`font-bold ${
                              needsService ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {item.hoursUsed}h / {item.serviceLimitHours}h
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              needsService ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 line-clamp-2">
                        {item.nextTask}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => onLogEquipmentHours(item.id, 1)}
                        className="min-h-[30px] px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                      >
                        +1h Uso
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetEquipmentService(item.id)}
                        className="min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
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
          className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Nueva Máquina
            </label>
            <input
              type="text"
              placeholder="Ej. Motoguadaña Echo SRM-4605"
              value={newMachineName}
              onChange={(e) => setNewMachineName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
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
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
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
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sumar Máquina</span>
          </button>
        </form>
      </div>

      {/* 2. Sincronización Nube y Copias de Seguridad en 2 Bento Tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bento-tile rounded-2xl p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Sincronización con Google Sheets
                </h3>
              </div>
              {googleUserEmail ? (
                <button
                  type="button"
                  onClick={onGoogleLogout}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Desconectar ({googleUserEmail})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Conectar Google
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Exportá y actualizá clientes, cobros y gastos en tu planilla de Google Drive.
            </p>
            <div className="flex gap-2 pt-1">
              <input
                id="sheet-id-input"
                type="text"
                placeholder="ID o URL de Google Sheet"
                value={connectedSpreadsheetId}
                onChange={(e) => onSetSpreadsheetIdInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg"
              />
              {connectedSpreadsheetUrl && (
                <a
                  href={connectedSpreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir</span>
                </a>
              )}
            </div>
            {lastSyncedAt && (
              <p className="text-[11px] text-emerald-700 font-mono">
                ✓ Sincronizado: {lastSyncedAt}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSyncingSheets}
              onClick={onRequestCreateGoogleSheet}
              className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Planilla</span>
            </button>
            <button
              type="button"
              disabled={isSyncingSheets || !connectedSpreadsheetId.trim()}
              onClick={onRequestSyncGoogleSheet}
              className="min-h-[34px] flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`}
              />
              <span>{isSyncingSheets ? 'Sincronizando...' : 'Actualizar Hoja'}</span>
            </button>
          </div>
        </div>

        <div className="bento-tile rounded-2xl p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Respaldo Local (.CSV / .JSON) y Datos de Prueba
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Descargá copias locales para Excel, importá un respaldo completo o reiniciá la base de datos.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onExportCsv}
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar .CSV</span>
            </button>
            <button
              type="button"
              onClick={onCopyGoogleSheetsTsv}
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              <span>Copiar Tabla</span>
            </button>
            <button
              type="button"
              onClick={onExportJsonBackup}
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup .JSON</span>
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
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar .JSON</span>
            </button>
            <button
              type="button"
              onClick={onRestoreDemoData}
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Demo</span>
            </button>
            <button
              type="button"
              onClick={onRequestClearAllData}
              className="min-h-[34px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Datos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

