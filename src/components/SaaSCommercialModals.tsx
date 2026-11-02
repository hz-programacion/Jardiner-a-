import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calculator,
  Check,
  CreditCard,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { CITY_PRESETS } from '../data/seedData';
import {
  BaseLocationConfig,
  BusinessProfileConfig,
  PaymentProfileConfig,
  SubscriptionPlanId,
  TenantSubscriptionConfig,
} from '../types/lawn';
import { calculateSuggestedPrice } from '../utils/lawnLogic';
import {
  activateTenantSubscriptionPlan,
  buildMercadoPagoSubscriptionUrl,
  evaluateSubscriptionStatus,
} from '../utils/saasLogic';

interface OnboardingWhiteLabelModalProps {
  isOpen: boolean;
  isFirstTimeSetup?: boolean;
  businessProfile: BusinessProfileConfig;
  baseLocation: BaseLocationConfig;
  paymentProfile: PaymentProfileConfig;
  userEmail?: string | null;
  onClose: () => void;
  onSaveCompleteConfiguration: (payload: {
    businessProfile: BusinessProfileConfig;
    baseLocation: BaseLocationConfig;
    paymentProfile: PaymentProfileConfig;
  }) => void;
}

const BRAND_COLORS = [
  { hex: '#059669', label: 'Esmeralda' },
  { hex: '#0F172A', label: 'Obsidiana' },
  { hex: '#15803D', label: 'Bosque' },
  { hex: '#0284C7', label: 'Atlántico' },
  { hex: '#B45309', label: 'Terracota' },
];

export function OnboardingWhiteLabelModal({
  isOpen,
  isFirstTimeSetup = false,
  businessProfile,
  baseLocation,
  paymentProfile,
  userEmail,
  onClose,
  onSaveCompleteConfiguration,
}: OnboardingWhiteLabelModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Brand & Logo
  const [appName, setAppName] = useState(businessProfile.appName);
  const [slogan, setSlogan] = useState(businessProfile.slogan);
  const [ownerName, setOwnerName] = useState(businessProfile.ownerName);
  const [ownerPhone, setOwnerPhone] = useState(businessProfile.ownerPhone);
  const [logoUrl, setLogoUrl] = useState(businessProfile.logoUrl || '');
  const [brandColor, setBrandColor] = useState(
    businessProfile.brandColor || '#059669'
  );

  // Step 2: City & Base GPS
  const [city, setCity] = useState(baseLocation.city);
  const [address, setAddress] = useState(baseLocation.address);
  const [lat, setLat] = useState(String(baseLocation.coordinates.lat));
  const [lng, setLng] = useState(String(baseLocation.coordinates.lng));

  // Step 3: Base Pricing Table
  const [baseRatePerSqm, setBaseRatePerSqm] = useState(
    String(businessProfile.baseRatePerSqm || 65)
  );
  const [minServicePrice, setMinServicePrice] = useState(
    String(businessProfile.minServicePrice || 15000)
  );
  const [tallGrassSurchargePct, setTallGrassSurchargePct] = useState(
    String(businessProfile.tallGrassSurchargePct ?? 30)
  );
  const [baggingSurchargePct, setBaggingSurchargePct] = useState(
    String(businessProfile.baggingSurchargePct ?? 15)
  );

  // Step 4: Payment Alias / CBU / Mercado Pago
  const [alias, setAlias] = useState(paymentProfile.alias);
  const [cbu, setCbu] = useState(paymentProfile.cbu);
  const [holderName, setHolderName] = useState(paymentProfile.holderName);
  const [bankName, setBankName] = useState(paymentProfile.bankName);
  const [cuit, setCuit] = useState(paymentProfile.cuit || '');
  const [mpPaymentLink, setMpPaymentLink] = useState(
    paymentProfile.mpPaymentLink || ''
  );

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAppName(businessProfile.appName);
      setSlogan(businessProfile.slogan);
      setOwnerName(businessProfile.ownerName);
      setOwnerPhone(businessProfile.ownerPhone);
      setLogoUrl(businessProfile.logoUrl || '');
      setBrandColor(businessProfile.brandColor || '#059669');
      setCity(baseLocation.city);
      setAddress(baseLocation.address);
      setLat(String(baseLocation.coordinates.lat));
      setLng(String(baseLocation.coordinates.lng));
      setBaseRatePerSqm(String(businessProfile.baseRatePerSqm || 65));
      setMinServicePrice(String(businessProfile.minServicePrice || 15000));
      setTallGrassSurchargePct(
        String(businessProfile.tallGrassSurchargePct ?? 30)
      );
      setBaggingSurchargePct(
        String(businessProfile.baggingSurchargePct ?? 15)
      );
      setAlias(paymentProfile.alias);
      setCbu(paymentProfile.cbu);
      setHolderName(paymentProfile.holderName || businessProfile.ownerName);
      setBankName(paymentProfile.bankName);
      setCuit(paymentProfile.cuit || '');
      setMpPaymentLink(paymentProfile.mpPaymentLink || '');
    }
  }, [isOpen, businessProfile, baseLocation, paymentProfile]);

  if (!isOpen) return null;

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectCityPreset = (presetKey: string) => {
    const preset = CITY_PRESETS[presetKey];
    if (!preset) return;
    setCity(preset.city);
    setAddress(preset.address);
    setLat(String(preset.coordinates.lat));
    setLng(String(preset.coordinates.lng));
  };

  const sampleCasaQuote = calculateSuggestedPrice(
    300,
    'Casa',
    'Quincenal',
    0,
    'Regular',
    true,
    {
      baseRatePerSqm: Number(baseRatePerSqm) || 65,
      minServicePrice: Number(minServicePrice) || 15000,
      tallGrassSurchargePct: Number(tallGrassSurchargePct) || 30,
      baggingSurchargePct: Number(baggingSurchargePct) || 15,
    }
  );

  const sampleQuintaQuote = calculateSuggestedPrice(
    900,
    'Quinta',
    'Quincenal',
    0,
    'Alto',
    true,
    {
      baseRatePerSqm: Number(baseRatePerSqm) || 65,
      minServicePrice: Number(minServicePrice) || 15000,
      tallGrassSurchargePct: Number(tallGrassSurchargePct) || 30,
      baggingSurchargePct: Number(baggingSurchargePct) || 15,
    }
  );

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAppName = appName.trim() || 'Mi Empresa de Jardinería';
    const cleanOwner = ownerName.trim() || 'Titular';
    const cleanCity = city.trim() || 'Rosario, Santa Fe';
    const cleanAddress = address.trim() || 'Centro';

    onSaveCompleteConfiguration({
      businessProfile: {
        appName: cleanAppName,
        slogan:
          slogan.trim() || 'Mantenimiento de Césped, Parques y Quintas',
        ownerName: cleanOwner,
        ownerPhone: ownerPhone.trim(),
        baseRatePerSqm: Math.max(10, Number(baseRatePerSqm) || 65),
        minServicePrice: Math.max(2000, Number(minServicePrice) || 15000),
        tallGrassSurchargePct: Math.max(
          0,
          Number(tallGrassSurchargePct) ?? 30
        ),
        baggingSurchargePct: Math.max(0, Number(baggingSurchargePct) ?? 15),
        logoUrl: logoUrl || undefined,
        brandColor: brandColor || '#059669',
        onboardingCompleted: true,
      },
      baseLocation: {
        name: `Base Operativa (${cleanCity})`,
        city: cleanCity,
        address: cleanAddress,
        coordinates: {
          lat: Math.round((Number(lat) || -32.9442) * 10000) / 10000,
          lng: Math.round((Number(lng) || -60.6505) * 10000) / 10000,
        },
        source: 'manual',
        updatedAt: new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      paymentProfile: {
        alias: alias.trim() || 'mi.alias.mp',
        cbu: cbu.trim(),
        holderName: holderName.trim() || cleanOwner,
        bankName:
          bankName.trim() || 'Mercado Pago / Transferencia Bancaria',
        cuit: cuit.trim() || undefined,
        mpPaymentLink: mpPaymentLink.trim() || undefined,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whitelabel-modal-title"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-7 shadow-xl my-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isFirstTimeSetup
                  ? 'BIENVENIDO · CONFIGURACIÓN INICIAL DE TU CUENTA'
                  : 'PERSONALIZACIÓN DE MARCA (WHITE-LABEL) Y TARIFAS'}
              </span>
            </div>
            <h2
              id="whitelabel-modal-title"
              className="font-display text-xl font-bold text-zinc-950"
            >
              Configura tu Marca, Ciudad, Precios Base y Alias
            </h2>
            <p className="text-xs text-zinc-500">
              {userEmail
                ? `Espacio privado multi-usuario de ${userEmail}. Tus clientes y datos están 100% aislados.`
                : 'Personaliza el sistema con tu propio nombre, logo, precios por m² y datos de cobro sin tocar código.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente de marca"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-zinc-100 p-1 rounded-xl">
          {[
            { id: 1, label: '1. Marca y Logo', icon: Building2 },
            { id: 2, label: '2. Tu Ciudad GPS', icon: MapPin },
            { id: 3, label: '3. Precios Base', icon: Calculator },
            { id: 4, label: '4. Alias y Cobro', icon: CreditCard },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id as 1 | 2 | 3 | 4)}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  active
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleFinish} className="space-y-5">
          {/* STEP 1: MARCA Y LOGO */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo de tu empresa"
                      className="w-14 h-14 rounded-xl object-cover border border-zinc-200 bg-white shrink-0"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: brandColor }}
                      className="w-14 h-14 rounded-xl text-white font-display font-bold text-lg flex items-center justify-center shrink-0"
                    >
                      {(appName || 'P')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-zinc-900">
                      Logo de tu Empresa (Aparece en cabecera y recibos)
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Sube una imagen PNG/JPG o elige el color de tu marca.
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {BRAND_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setBrandColor(c.hex)}
                          title={c.label}
                          style={{ backgroundColor: c.hex }}
                          className={`w-5 h-5 rounded-full border ${
                            brandColor === c.hex
                              ? 'ring-2 ring-offset-1 ring-zinc-900 border-white'
                              : 'border-zinc-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-100 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Subir Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="wl-app-name"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Nombre Comercial de tu Empresa *
                  </label>
                  <input
                    id="wl-app-name"
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Ej: Parques Rosario, Córdoba Verde..."
                    className="w-full px-3.5 py-2.5 text-sm font-semibold bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-owner-name"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Nombre del Titular / Prestador *
                  </label>
                  <input
                    id="wl-owner-name"
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      if (!holderName || holderName === businessProfile.ownerName) {
                        setHolderName(e.target.value);
                      }
                    }}
                    placeholder="Ej: Martín Gómez"
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-slogan"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Especialidad / Eslogan para Recibos
                  </label>
                  <input
                    id="wl-slogan"
                    type="text"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="Mantenimiento de Jardines, Countries y Quintas"
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-phone"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    WhatsApp Comercial de Contacto
                  </label>
                  <input
                    id="wl-phone"
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="Ej: +54 9 341 555-0199"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CIUDAD Y ZONA DE OPERACIÓN */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950">
                Selecciona tu ciudad principal. El mapa de rutas GPS, el
                buscador de calles y el pronóstico meteorológico se ajustarán
                automáticamente a tu zona de trabajo.
              </div>

              <div>
                <span className="block text-xs font-semibold text-zinc-700 mb-2">
                  Elegir Ciudad de Argentina (1 clic):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(CITY_PRESETS).map((presetKey) => {
                    const preset = CITY_PRESETS[presetKey];
                    const isSelected = city === preset.city;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => handleSelectCityPreset(presetKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isSelected
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {presetKey}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div>
                  <label
                    htmlFor="wl-city"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Ciudad / Zona de Operación
                  </label>
                  <input
                    id="wl-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej: Rosario, Córdoba, Pilar..."
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wl-address"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Dirección o Punto de Salida Habitual
                  </label>
                  <input
                    id="wl-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej: Av. Pellegrini 1500"
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CUADRO TARIFARIO BASE */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="wl-rate-sqm"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Precio Base por Metro Cuadrado ($/m²)
                  </label>
                  <input
                    id="wl-rate-sqm"
                    type="number"
                    min={10}
                    step={5}
                    value={baseRatePerSqm}
                    onChange={(e) => setBaseRatePerSqm(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-min-price"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Tarifa Mínima por Visita / Salida ($)
                  </label>
                  <input
                    id="wl-min-price"
                    type="number"
                    min={1000}
                    step={500}
                    value={minServicePrice}
                    onChange={(e) => setMinServicePrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-tall-pct"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Recargo por Pasto Alto / Desmalezado (%)
                  </label>
                  <input
                    id="wl-tall-pct"
                    type="number"
                    min={0}
                    max={200}
                    value={tallGrassSurchargePct}
                    onChange={(e) => setTallGrassSurchargePct(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-bag-pct"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Recargo por Embolsado / Recolección (%)
                  </label>
                  <input
                    id="wl-bag-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={baggingSurchargePct}
                    onChange={(e) => setBaggingSurchargePct(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="text-xs font-bold text-zinc-900">
                  Simulación en Vivo con tu Cuadro Tarifario:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-zinc-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-900">
                        Casa 300 m² (Regular)
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Quincenal + Embolsado
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-emerald-700 tabular-nums">
                      ${sampleCasaQuote.suggestedPrice.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-zinc-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-900">
                        Quinta 900 m² (Pasto Alto)
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Quincenal + Desmalezado
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-emerald-700 tabular-nums">
                      $
                      {sampleQuintaQuote.suggestedPrice.toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ALIAS DE COBRO Y DATOS BANCARIOS */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="wl-alias"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Tu Alias de Cobro (Mercado Pago / Banco) *
                  </label>
                  <input
                    id="wl-alias"
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Ej: parques.rosario.mp"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-holder"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Titular de la Cuenta
                  </label>
                  <input
                    id="wl-holder"
                    type="text"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Nombre y Apellido"
                    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-bank"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    Billetera / Banco
                  </label>
                  <input
                    id="wl-bank"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ej: Mercado Pago / Banco Macro"
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label
                    htmlFor="wl-cbu"
                    className="block text-xs font-semibold text-zinc-700 mb-1"
                  >
                    CBU / CVU (Opcional)
                  </label>
                  <input
                    id="wl-cbu"
                    type="text"
                    value={cbu}
                    onChange={(e) => setCbu(e.target.value)}
                    placeholder="22 dígitos (opcional)"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                <div className="font-bold text-emerald-950">
                  Vista previa en tus recibos de WhatsApp:
                </div>
                <p className="font-mono text-[11px] text-emerald-900">
                  • Comprobante de {appName || 'Tu Empresa'} ({city}) · Alias
                  para transferencia: {alias || 'tu.alias.mp'} (Titular:{' '}
                  {holderName || ownerName || 'Titular'} - {bankName})
                </p>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                >
                  ← Paso Anterior
                </button>
              )}
              {step < 4 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
                >
                  Siguiente Paso →
                </button>
              )}
            </div>

            <button
              type="submit"
              data-testid="save-whitelabel-btn"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Mi Marca, Ciudad y Precios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SubscriptionMercadoPagoModalProps {
  isOpen: boolean;
  subscription: TenantSubscriptionConfig;
  businessName: string;
  userEmail?: string | null;
  activeDateStr: string;
  onClose: () => void;
  onUpdateSubscription: (updated: TenantSubscriptionConfig) => void;
  onShowBanner: (msg: string) => void;
}

export function SubscriptionMercadoPagoModal({
  isOpen,
  subscription,
  businessName,
  userEmail,
  activeDateStr,
  onClose,
  onUpdateSubscription,
  onShowBanner,
}: SubscriptionMercadoPagoModalProps) {
  const [selectedPlan, setSelectedPlan] =
    useState<Exclude<SubscriptionPlanId, 'trial'>>('pro_monthly');
  const [referenceInput, setReferenceInput] = useState('');
  const [showSellerConfig, setShowSellerConfig] = useState(false);

  // Seller SaaS configuration states
  const [mpPreapprovalPlanId, setMpPreapprovalPlanId] = useState(
    subscription.mpPreapprovalPlanId || '2c9380848e9b1d4a018ea2f9c020014b'
  );
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState(
    subscription.mpCheckoutUrl || ''
  );
  const [monthlyPriceArs, setMonthlyPriceArs] = useState(
    String(subscription.monthlyPriceArs || 18500)
  );
  const [annualPriceArs, setAnnualPriceArs] = useState(
    String(subscription.annualPriceArs || 185000)
  );
  const [installedLicensePriceArs, setInstalledLicensePriceArs] = useState(
    String(subscription.installedLicensePriceArs || 240000)
  );

  useEffect(() => {
    if (isOpen) {
      setMpPreapprovalPlanId(
        subscription.mpPreapprovalPlanId || '2c9380848e9b1d4a018ea2f9c020014b'
      );
      setMpCheckoutUrl(subscription.mpCheckoutUrl || '');
      setMonthlyPriceArs(String(subscription.monthlyPriceArs || 18500));
      setAnnualPriceArs(String(subscription.annualPriceArs || 185000));
      setInstalledLicensePriceArs(
        String(subscription.installedLicensePriceArs || 240000)
      );
    }
  }, [isOpen, subscription]);

  if (!isOpen) return null;

  const evalState = evaluateSubscriptionStatus(subscription, activeDateStr);
  const checkoutUrl = buildMercadoPagoSubscriptionUrl(
    subscription,
    selectedPlan,
    userEmail
  );

  const handleConfirmPaymentOrLicense = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = activateTenantSubscriptionPlan(
      subscription,
      selectedPlan,
      selectedPlan === 'installed_license'
        ? 'Transferencia / Licencia'
        : 'Mercado Pago Suscripción',
      referenceInput,
      activeDateStr
    );
    onUpdateSubscription(updated);
    setReferenceInput('');
    onShowBanner(
      `¡Suscripción activada para ${businessName}! Estado: Plan Activo en Cloud Firestore.`
    );
  };

  const handleSaveSellerSaaSConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSubscription({
      ...subscription,
      mpPreapprovalPlanId: mpPreapprovalPlanId.trim(),
      mpCheckoutUrl: mpCheckoutUrl.trim(),
      monthlyPriceArs: Math.max(1000, Number(monthlyPriceArs) || 18500),
      annualPriceArs: Math.max(10000, Number(annualPriceArs) || 185000),
      installedLicensePriceArs: Math.max(
        20000,
        Number(installedLicensePriceArs) || 240000
      ),
    });
    setShowSellerConfig(false);
    onShowBanner(
      'Configuración comercial de pasarela Mercado Pago actualizada.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-modal-title"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-7 shadow-xl my-6 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-sky-700 font-semibold">
              <CreditCard className="w-3.5 h-3.5" />
              <span>PASARELA DE SUSCRIPCIÓN SAAS · MERCADO PAGO</span>
            </div>
            <h2
              id="subscription-modal-title"
              className="font-display text-xl font-bold text-zinc-950"
            >
              Suscripción y Licencia Comercial — {businessName}
            </h2>
            <p className="text-xs text-zinc-500">
              Gestiona tu abono mensual por débito automático con Mercado Pago o
              activa tu licencia instalada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar pasarela de suscripción"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Plan Banner */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs text-zinc-500 font-medium">
              Estado de tu Cuenta ({userEmail || 'Cuenta Local / Cloud'}):
            </div>
            <div className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <span>{evalState.planName}</span>
              <span
                className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold ${
                  evalState.isProActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : evalState.status === 'expired'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {evalState.badgeText}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSellerConfig(!showSellerConfig)}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline"
          >
            {showSellerConfig
              ? 'Ocultar configuración de pasarela'
              : 'Configurar link de cobro Mercado Pago (Admin SaaS)'}
          </button>
        </div>

        {/* Optional SaaS Owner Configuration Panel */}
        {showSellerConfig && (
          <form
            onSubmit={handleSaveSellerSaaSConfig}
            className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3"
          >
            <div className="text-xs font-bold text-sky-950">
              Configuración del Vendedor del Software (Tu Pasarela Mercado Pago)
            </div>
            <p className="text-[11px] text-sky-900">
              Pega aquí tu Link de Suscripción de Mercado Pago (o ID de plan{' '}
              <code>preapproval_plan_id</code>) y define los precios en pesos
              que cobrarás a los jardineros que se den de alta.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Link directo de Suscripción Mercado Pago (Opcional)
                </label>
                <input
                  type="url"
                  value={mpCheckoutUrl}
                  onChange={(e) => setMpCheckoutUrl(e.target.value)}
                  placeholder="https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=..."
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-sky-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Abono Mensual ($ ARS)
                </label>
                <input
                  type="number"
                  value={monthlyPriceArs}
                  onChange={(e) => setMonthlyPriceArs(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-sky-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Abono Anual ($ ARS)
                </label>
                <input
                  type="number"
                  value={annualPriceArs}
                  onChange={(e) => setAnnualPriceArs(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-sky-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg"
              >
                Guardar Parámetros de Pasarela
              </button>
            </div>
          </form>
        )}

        {/* Plan Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'pro_monthly' as const,
              title: 'Abono Mensual',
              price: subscription.monthlyPriceArs || 18500,
              period: '/ mes',
              desc: 'Débito automático vía Mercado Pago. Clientes, rutas GPS y recibos ilimitados.',
            },
            {
              id: 'pro_annual' as const,
              title: 'Plan Anual Pro',
              price: subscription.annualPriceArs || 185000,
              period: '/ año',
              desc: '2 meses bonificados. Ideal para empresas de mantenimiento de parques y countries.',
            },
            {
              id: 'installed_license' as const,
              title: 'Software Instalado',
              price: subscription.installedLicensePriceArs || 240000,
              period: 'pago único',
              desc: 'Licencia comercial White-Label instalada con tu marca propia y dominio.',
            },
          ].map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold opacity-80">
                    {plan.title}
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums mt-1">
                    ${plan.price.toLocaleString('es-AR')}
                    <span className="text-xs font-sans font-normal opacity-75">
                      {' '}
                      {plan.period}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-2 leading-relaxed ${
                      isSelected ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {plan.desc}
                  </p>
                </div>
                <div
                  className={`mt-3 text-[11px] font-semibold inline-flex items-center gap-1 ${
                    isSelected ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Seleccionado' : 'Elegir plan'}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Direct Mercado Pago Checkout + Instant Verification */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-zinc-950">
                Paso 1: Pagar Suscripción Segura con Mercado Pago
              </div>
              <p className="text-[11px] text-zinc-500">
                Abre el checkout oficial de suscripciones de Mercado Pago en
                pesos argentinos.
              </p>
            </div>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mercadopago-checkout-link"
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#009EE3] hover:bg-[#0089C7] rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <CreditCard className="w-4 h-4" />
              <span>Suscribirme con Mercado Pago</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <form
            onSubmit={handleConfirmPaymentOrLicense}
            className="pt-3 border-t border-zinc-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <input
              type="text"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="N° de comprobante Mercado Pago o Clave de Licencia (opcional)"
              className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-zinc-200 rounded-xl"
            />
            <button
              type="submit"
              data-testid="activate-subscription-btn"
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Validar Pago / Activar Plan Ahora</span>
            </button>
          </form>
        </div>

        {/* Payment History */}
        {subscription.paymentHistory &&
          subscription.paymentHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-900">
                Historial de Pagos y Licencias Registradas
              </div>
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {subscription.paymentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-white"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">
                        {item.planLabel}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        {item.date} · {item.method} · Ref: {item.referenceCode}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700 tabular-nums">
                      ${item.amountArs.toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
