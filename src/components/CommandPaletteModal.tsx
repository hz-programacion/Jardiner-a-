import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Calendar,
  CloudRain,
  Compass,
  FileSpreadsheet,
  Leaf,
  MapPin,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { ClientProperty, ScheduledJob } from '../types/lawn';

export interface CommandPaletteActionItem {
  id: string;
  category: 'Acciones Rápidas' | 'Módulos' | 'Paradas de Hoy' | 'Clientes';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  todayJobs: ScheduledJob[];
  properties: ClientProperty[];
  isDarkMode: boolean;
  isEasyAccessMode: boolean;
  onClose: () => void;
  onNavigateTab: (
    tab:
      | 'ruta'
      | 'agenda'
      | 'clientes'
      | 'jardineria'
      | 'cotizador'
      | 'facturacion'
      | 'respaldo'
  ) => void;
  onSelectJobOnRoute: (jobId: string) => void;
  onOpenClientHistory: (property: ClientProperty) => void;
  onOpenNewCutModal: () => void;
  onOptimizeRoute2Opt: () => void;
  onRainDelay: () => void;
  onToggleDarkMode: () => void;
  onToggleVoiceMode: () => void;
}

export function CommandPaletteModal({
  isOpen,
  todayJobs,
  properties,
  isDarkMode,
  isEasyAccessMode,
  onClose,
  onNavigateTab,
  onSelectJobOnRoute,
  onOpenClientHistory,
  onOpenNewCutModal,
  onOptimizeRoute2Opt,
  onRainDelay,
  onToggleDarkMode,
  onToggleVoiceMode,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const allItems = useMemo<CommandPaletteActionItem[]>(() => {
    const actions: CommandPaletteActionItem[] = [
      {
        id: 'act-new-cut',
        category: 'Acciones Rápidas',
        title: 'Programar Nuevo Corte o Registrar Lote',
        subtitle: 'Abrir formulario de cliente y visita',
        icon: Plus,
        onSelect: () => {
          onClose();
          onOpenNewCutModal();
        },
      },
      {
        id: 'act-opt-2opt',
        category: 'Acciones Rápidas',
        title: 'Optimizar Secuencia GPS con Motor 2-Opt TSP',
        subtitle: 'Recalcular orden óptimo en servidor para ahorrar km y mezcla 2T',
        icon: Sparkles,
        onSelect: () => {
          onClose();
          onOptimizeRoute2Opt();
        },
      },
      {
        id: 'act-rain-delay',
        category: 'Acciones Rápidas',
        title: 'Postergar Paradas Pendientes por Lluvia (+1 día)',
        subtitle: 'Reprogramar visitas sin completar al día siguiente',
        icon: CloudRain,
        onSelect: () => {
          onClose();
          onRainDelay();
        },
      },
      {
        id: 'act-voice',
        category: 'Acciones Rápidas',
        title: isEasyAccessMode
          ? 'Desactivar Modo Lectura por Voz'
          : 'Activar Modo Lectura por Voz y Botones Grandes',
        subtitle: 'Accesibilidad auditiva en terreno',
        icon: Volume2,
        onSelect: () => {
          onClose();
          onToggleVoiceMode();
        },
      },
      {
        id: 'act-theme',
        category: 'Acciones Rápidas',
        title: isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
        subtitle: 'Ajustar contraste visual de la interfaz',
        icon: isDarkMode ? Sun : Moon,
        onSelect: () => {
          onClose();
          onToggleDarkMode();
        },
      },
    ];

    const modules: CommandPaletteActionItem[] = [
      {
        id: 'mod-ruta',
        category: 'Módulos',
        title: 'Hoja de Ruta GPS y Órdenes del Día',
        subtitle: `${todayJobs.length} paradas programadas en la fecha activa`,
        icon: Compass,
        onSelect: () => {
          onClose();
          onNavigateTab('ruta');
        },
      },
      {
        id: 'mod-agenda',
        category: 'Módulos',
        title: 'Agenda y Calendario Mensual',
        subtitle: 'Planificación por día, semana y mes',
        icon: Calendar,
        onSelect: () => {
          onClose();
          onNavigateTab('agenda');
        },
      },
      {
        id: 'mod-clientes',
        category: 'Módulos',
        title: 'Cartera de Clientes y Lotes',
        subtitle: `${properties.length} propiedades registradas`,
        icon: Users,
        onSelect: () => {
          onClose();
          onNavigateTab('clientes');
        },
      },
      {
        id: 'mod-jardineria',
        category: 'Módulos',
        title: 'Manual Agronómico de Césped y Extras de Estación',
        subtitle: 'Alturas de corte por especie, checklist de salida y poda',
        icon: Leaf,
        onSelect: () => {
          onClose();
          onNavigateTab('jardineria');
        },
      },
      {
        id: 'mod-cotizador',
        category: 'Módulos',
        title: 'Cotizador Técnico por Superficie ($/m²)',
        subtitle: 'Presupuestos de corte único vs. abono quincenal',
        icon: Calculator,
        onSelect: () => {
          onClose();
          onNavigateTab('cotizador');
        },
      },
      {
        id: 'mod-facturacion',
        category: 'Módulos',
        title: 'Flujo de Caja, Recibos PDF y Galería Antes/Después',
        subtitle: 'Cobros, gastos operativos y evidencia fotográfica',
        icon: BarChart3,
        onSelect: () => {
          onClose();
          onNavigateTab('facturacion');
        },
      },
      {
        id: 'mod-respaldo',
        category: 'Módulos',
        title: 'Flota de Maquinaria y Sincronización Google Sheets',
        subtitle: 'Horas de uso de motoguadañas/tractores y backups',
        icon: FileSpreadsheet,
        onSelect: () => {
          onClose();
          onNavigateTab('respaldo');
        },
      },
    ];

    const jobItems: CommandPaletteActionItem[] = todayJobs.map((job) => ({
      id: `job-${job.id}`,
      category: 'Paradas de Hoy',
      title: `#${job.orderIndex} · ${job.clientName} (${job.scheduledTime} hs)`,
      subtitle: `${job.address} · ${job.neighborhood} · $${job.price.toLocaleString('es-AR')}`,
      icon: MapPin,
      onSelect: () => {
        onClose();
        onNavigateTab('ruta');
        onSelectJobOnRoute(job.id);
      },
    }));

    const clientItems: CommandPaletteActionItem[] = properties.map((prop) => ({
      id: `prop-${prop.id}`,
      category: 'Clientes',
      title: prop.clientName,
      subtitle: `${prop.address} (${prop.neighborhood}) · ${prop.areaSqm} m² · $${prop.basePrice.toLocaleString('es-AR')}`,
      icon: Users,
      onSelect: () => {
        onClose();
        onOpenClientHistory(prop);
      },
    }));

    return [...actions, ...modules, ...jobItems, ...clientItems];
  }, [
    todayJobs,
    properties,
    isDarkMode,
    isEasyAccessMode,
    onClose,
    onNavigateTab,
    onSelectJobOnRoute,
    onOpenClientHistory,
    onOpenNewCutModal,
    onOptimizeRoute2Opt,
    onRainDelay,
    onToggleDarkMode,
    onToggleVoiceMode,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 12);
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setActiveIndex(
          (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredItems[activeIndex];
      if (target) {
        target.onSelect();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="command-palette-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos y búsqueda rápida"
          className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs"
          />

          {/* Command Palette Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={handleKeyDown}
            className="relative z-10 w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Search Input Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-200/80">
              <Search className="w-4 h-4 text-emerald-700 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                data-testid="command-palette-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, dirección, módulo o acción rápida..."
                className="flex-1 text-sm text-stone-900 placeholder:text-stone-400 bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar buscador rápido"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div
              role="listbox"
              aria-label="Resultados de comandos"
              className="max-h-[380px] overflow-y-auto p-2 divide-y divide-stone-100"
            >
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-500">
                  No se encontraron resultados para «{query}».
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.onSelect}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#23533B] text-white'
                          : 'text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 text-[#23533B]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold truncate">
                            {item.title}
                          </div>
                          <div
                            className={`text-xs truncate ${
                              isSelected ? 'text-white/80' : 'text-stone-500'
                            }`}
                          >
                            {item.category} · {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-white' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Keyboard Hints */}
            <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between text-[11px] font-mono text-stone-500">
              <span>↑↓ Navegar · Enter Ejecutar · Esc Cerrar</span>
              <span>Motor 2-Opt TSP & Sello Criptográfico Activos</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
