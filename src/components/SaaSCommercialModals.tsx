import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calculator,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Settings,
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
  TenantSubscriptionConfig,
} from '../types/lawn';
import {
  buildSafeWhatsAppUrl,
  calculateSuggestedPrice,
  resolveCityCoordinates,
} from '../utils/lawnLogic';
import {
  activateTenantSingleLicense,
  buildMercadoPagoSinglePaymentUrl,
  DEFAULT_SINGLE_LICENSE_CONFIG,
  evaluateSubscriptionStatus,
  hasValidCustomMercadoPagoLink,
  normalizeTenantLicenseConfig,
} from '../utils/saasLogic';
import {
  CityAutocomplete,
  StreetAddressAutocomplete,
} from './StreetAddressAutocomplete';

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
    const resolvedCity = resolveCityCoordinates(cleanCity);

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
        brandColor: brandColor || '#0D9488',
        onboardingCompleted: true,
      },
      baseLocation: {
        name: `Base Operativa (${resolvedCity.fullName || cleanCity})`,
        city: resolvedCity.fullName || cleanCity,
        address: cleanAddress || resolvedCity.defaultAddress,
        coordinates: {
          lat:
            Math.round(
              (Number(lat) || resolvedCity.coordinates.lat || -32.9442) *
                10000
            ) / 10000,
          lng:
            Math.round(
              (Number(lng) || resolvedCity.coordinates.lng || -60.6505) *
                10000
            ) / 10000,
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
              <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 text-xs text-teal-950">
                Escribe las primeras letras de tu ciudad o localidad de
                Argentina (por ejemplo, escribe <strong>"Venado"</strong> y el
                sistema te recomendará <strong>"Venado Tuerto, Santa Fe"</strong>{' '}
                con sus coordenadas GPS exactas).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <CityAutocomplete
                    id="wl-city"
                    label="Ciudad / Localidad de Argentina *"
                    placeholder="Escribe ej: Venado, Rosario, Pilar, Tandil..."
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
                    id="wl-address"
                    label="Dirección o Punto de Salida Habitual"
                    placeholder="Ej: Bv. 25 de Mayo 850 o Av. Pellegrini 1500"
                    value={address}
                    activeCity={city}
                    onChange={(val) => setAddress(val)}
                    onSelectSuggestion={(sug) => {
                      setAddress(sug.streetAddress);
                      setLat(String(sug.coordinates.lat));
                      setLng(String(sug.coordinates.lng));
                    }}
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
  const [referenceInput, setReferenceInput] = useState('');
  const [copiedField, setCopiedField] = useState<'alias' | 'cbu' | 'mp' | null>(null);
  const [showSellerConfig, setShowSellerConfig] = useState(false);

  const normalizedSub = normalizeTenantLicenseConfig(
    subscription as unknown as Partial<TenantSubscriptionConfig> &
      Record<string, unknown>
  );

  const [sellerAliasDraft, setSellerAliasDraft] = useState(
    normalizedSub.sellerAlias || DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias
  );
  const [sellerCbuDraft, setSellerCbuDraft] = useState(
    normalizedSub.sellerCbu || DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu
  );
  const [sellerHolderDraft, setSellerHolderDraft] = useState(
    normalizedSub.sellerHolder || DEFAULT_SINGLE_LICENSE_CONFIG.sellerHolder
  );
  const [sellerWhatsappDraft, setSellerWhatsappDraft] = useState(
    normalizedSub.sellerWhatsapp || DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp
  );
  const [sellerPriceDraft, setSellerPriceDraft] = useState(
    String(
      normalizedSub.singleLicensePriceArs ||
        DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs
    )
  );
  const [customMpLinkDraft, setCustomMpLinkDraft] = useState(
    hasValidCustomMercadoPagoLink(normalizedSub.mpCheckoutUrl)
      ? normalizedSub.mpCheckoutUrl || ''
      : ''
  );

  useEffect(() => {
    if (isOpen) {
      const sub = normalizeTenantLicenseConfig(
        subscription as unknown as Partial<TenantSubscriptionConfig> &
          Record<string, unknown>
      );
      setSellerAliasDraft(
        sub.sellerAlias || DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias
      );
      setSellerCbuDraft(
        sub.sellerCbu || DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu
      );
      setSellerHolderDraft(
        sub.sellerHolder || DEFAULT_SINGLE_LICENSE_CONFIG.sellerHolder
      );
      setSellerWhatsappDraft(
        sub.sellerWhatsapp || DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp
      );
      setSellerPriceDraft(
        String(
          sub.singleLicensePriceArs ||
            DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs
        )
      );
      setCustomMpLinkDraft(
        hasValidCustomMercadoPagoLink(sub.mpCheckoutUrl)
          ? sub.mpCheckoutUrl || ''
          : ''
      );
    }
  }, [isOpen, subscription]);

  if (!isOpen) return null;

  const evalState = evaluateSubscriptionStatus(normalizedSub, activeDateStr);
  const hasCustomMpLink = hasValidCustomMercadoPagoLink(
    normalizedSub.mpCheckoutUrl
  );
  const checkoutUrl = buildMercadoPagoSinglePaymentUrl(
    normalizedSub,
    userEmail
  );
  const licensePrice =
    normalizedSub.singleLicensePriceArs ||
    DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs;
  const activeAlias =
    normalizedSub.sellerAlias || DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias;
  const activeCbu =
    normalizedSub.sellerCbu || DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu;
  const activeHolder =
    normalizedSub.sellerHolder || DEFAULT_SINGLE_LICENSE_CONFIG.sellerHolder;
  const activeWhatsapp =
    normalizedSub.sellerWhatsapp || DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp;

  const copyTextSafe = async (
    text: string,
    field: 'alias' | 'cbu' | 'mp'
  ) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Fallback silent
    }
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 3500);
  };

  const handlePayWithMercadoPagoAction = async () => {
    await copyTextSafe(activeAlias, 'mp');
    onShowBanner(
      `Alias "${activeAlias}" copiado al portapapeles. Pegalo en la opción "Transferir" de tu app Mercado Pago.`
    );
  };

  const handleSaveSellerPaymentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrice = Math.max(
      1000,
      Number(sellerPriceDraft) || DEFAULT_SINGLE_LICENSE_CONFIG.singleLicensePriceArs
    );
    const cleanMpUrl = customMpLinkDraft.trim();
    const updated: TenantSubscriptionConfig = {
      ...normalizedSub,
      sellerAlias:
        sellerAliasDraft.trim() || DEFAULT_SINGLE_LICENSE_CONFIG.sellerAlias,
      sellerCbu:
        sellerCbuDraft.trim() || DEFAULT_SINGLE_LICENSE_CONFIG.sellerCbu,
      sellerHolder:
        sellerHolderDraft.trim() || DEFAULT_SINGLE_LICENSE_CONFIG.sellerHolder,
      sellerWhatsapp:
        sellerWhatsappDraft.trim() ||
        DEFAULT_SINGLE_LICENSE_CONFIG.sellerWhatsapp,
      singleLicensePriceArs: cleanPrice,
      mpCheckoutUrl: hasValidCustomMercadoPagoLink(cleanMpUrl)
        ? cleanMpUrl
        : '',
    };
    onUpdateSubscription(updated);
    setShowSellerConfig(false);
    onShowBanner(
      'Datos de cobro de licencia (Alias, CVU y enlace de Mercado Pago) actualizados correctamente.'
    );
  };

  const handleConfirmPaymentOrLicense = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = referenceInput.trim();
    const method =
      cleanCode.toUpperCase().startsWith('LIC-') ||
      cleanCode.toUpperCase().startsWith('KEY-')
        ? 'Transferencia / Clave de Licencia'
        : 'Mercado Pago Pago Único';

    const updated = activateTenantSingleLicense(
      normalizedSub,
      method,
      cleanCode,
      activeDateStr
    );
    onUpdateSubscription(updated);
    setReferenceInput('');
    onShowBanner(
      `¡Licencia Definitiva activada para ${businessName}! Tu cuenta tiene acceso completo sin vencimientos mensuales.`
    );
  };

  const whatsappProofUrl = buildSafeWhatsAppUrl(
    activeWhatsapp,
    `Hola, realicé el pago único de la Licencia PastoPro ($${licensePrice.toLocaleString('es-AR')} ARS) al alias ${activeAlias}.\n\n• Emprendimiento: ${businessName}\n• Cuenta: ${userEmail || 'Local'}\n• N° Comprobante: ${referenceInput.trim() || 'Adjunto comprobante'}`
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-modal-title"
    >
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 shadow-xl my-4 space-y-5 break-words">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>LICENCIA DE USO COMERCIAL · PAGO ÚNICO</span>
            </div>
            <h2
              id="subscription-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-zinc-950 break-words"
            >
              Activación Definitiva — {businessName}
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Adquirí tu licencia de uso mediante un único pago por Mercado Pago
              (Transferencia por Alias/CVU o Link de Pago), sin abonos mensuales.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de licencia"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-zinc-400 hover:text-zinc-900 rounded-lg shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Estado actual de la licencia */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs text-zinc-500 font-medium break-all">
              Estado de Licencia ({userEmail || 'Espacio de Trabajo'}):
            </div>
            <div className="text-sm sm:text-base font-bold text-zinc-950 flex flex-wrap items-center gap-2">
              <span>{evalState.planName}</span>
              <span
                className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md font-semibold ${
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
          {normalizedSub.licenseKey && (
            <div className="text-xs font-mono text-zinc-600 bg-white px-2.5 py-1 rounded-lg border border-zinc-200 break-all">
              Clave: <span className="font-bold">{normalizedSub.licenseKey}</span>
            </div>
          )}
        </div>

        {/* Tarjeta Única de Licencia de Pago Único + Datos de Mercado Pago */}
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-zinc-950 bg-zinc-950 text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3.5">
            <div className="min-w-0">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                SIN CARGOS RECURRENTES NI SUSCRIPCIONES
              </span>
              <h3 className="text-base sm:text-lg font-bold mt-0.5">
                Licencia Comercial Completa (Pago Único)
              </h3>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                ${licensePrice.toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] text-zinc-400">
                Pago único definitivo · ARS
              </div>
            </div>
          </div>

          {/* Datos Oficiales de Transferencia Mercado Pago (Alias y CVU) */}
          <div
            data-testid="mercadopago-transfer-box"
            className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#009EE3] font-bold">
                DATOS OFICIALES MERCADO PAGO / TRANSFERENCIA
              </span>
              <button
                type="button"
                onClick={() => setShowSellerConfig((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-300 hover:text-white underline cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>
                  {showSellerConfig
                    ? 'Ocultar configuración de cobro'
                    : 'Configurar mi Alias / Link MP'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-zinc-950/90 border border-zinc-800 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                    Alias Mercado Pago
                  </span>
                  <span
                    data-testid="mp-license-alias-value"
                    className="font-mono font-bold text-sm text-emerald-300 break-all"
                  >
                    {activeAlias}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="copy-mp-alias-btn"
                  onClick={() => copyTextSafe(activeAlias, 'alias')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedField === 'alias' ? '✓ Copiado' : 'Copiar Alias'}</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/90 border border-zinc-800 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                    CVU / CBU (Transferencia Bancaria o Billetera)
                  </span>
                  <span className="font-mono font-bold text-zinc-200 break-all text-xs sm:text-sm">
                    {activeCbu}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyTextSafe(activeCbu, 'cbu')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedField === 'cbu' ? '✓ Copiado' : 'Copiar CVU'}</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-1">
              <span>
                Titular: <strong className="text-zinc-200">{activeHolder}</strong>
              </span>
              <span>Acreditación inmediata</span>
            </div>

            {copiedField === 'mp' && (
              <div
                role="status"
                data-testid="mp-copied-confirmation"
                className="p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs leading-relaxed"
              >
                ✓ <strong>Alias "{activeAlias}" copiado al portapapeles.</strong>{' '}
                Abrí tu app de Mercado Pago o billetera, elegí{' '}
                <strong>"Transferir"</strong>, pegá el alias y aboná{' '}
                <strong>${licensePrice.toLocaleString('es-AR')}</strong>.
              </div>
            )}
          </div>

          {/* Formulario opcional para que el Admin / Vendedor configure su propio Alias o Link mpago.la */}
          {showSellerConfig && (
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-emerald-500/40 space-y-3 text-xs">
              <div className="font-bold text-emerald-300">
                Personalizar Datos de Cobro de la Licencia (Vendedor / Admin)
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Si en Mercado Pago te apareció "algo salió mal", era porque el
                link de ejemplo no correspondía a una cuenta real. Acá podés
                poner tu propio Alias, CVU y (opcionalmente) un Link de Pago real
                generado desde tu app de Mercado Pago ("Cobrar con Link de Pago").
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-zinc-300 mb-1">
                    Alias de Mercado Pago
                  </label>
                  <input
                    type="text"
                    value={sellerAliasDraft}
                    onChange={(e) => setSellerAliasDraft(e.target.value)}
                    placeholder="mi.alias.mp"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-300 mb-1">
                    CVU / CBU (22 dígitos)
                  </label>
                  <input
                    type="text"
                    value={sellerCbuDraft}
                    onChange={(e) => setSellerCbuDraft(e.target.value)}
                    placeholder="00000031000..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-300 mb-1">
                    Nombre del Titular
                  </label>
                  <input
                    type="text"
                    value={sellerHolderDraft}
                    onChange={(e) => setSellerHolderDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-300 mb-1">
                    Valor Licencia Pago Único ($ ARS)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={sellerPriceDraft}
                    onChange={(e) => setSellerPriceDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-zinc-300 mb-1">
                    Link de Pago Mercado Pago (Opcional — ej. https://mpago.la/...)
                  </label>
                  <input
                    type="url"
                    value={customMpLinkDraft}
                    onChange={(e) => setCustomMpLinkDraft(e.target.value)}
                    placeholder="Dejar vacío para cobrar por Alias/CVU sin errores"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSellerPaymentSettings}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Guardar Datos de Cobro
                </button>
              </div>
            </div>
          )}

          <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {hasCustomMpLink ? (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="mercadopago-checkout-link"
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#009EE3] hover:bg-[#0089C7] rounded-xl transition-colors text-center break-words"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Abrir Link de Pago Mercado Pago</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            ) : (
              <button
                type="button"
                onClick={handlePayWithMercadoPagoAction}
                data-testid="mercadopago-checkout-link"
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#009EE3] hover:bg-[#0089C7] rounded-xl transition-colors text-center cursor-pointer break-words"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>
                  {copiedField === 'mp'
                    ? '✓ Alias Copiado · Listo para Transferir'
                    : 'Pagar con Mercado Pago (Copiar Alias)'}
                </span>
              </button>
            )}

            <a
              href={whatsappProofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors text-center break-words"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Enviar Comprobante por WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Validación de Comprobante o Clave de Activación */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
          <div>
            <div className="text-xs font-bold text-zinc-950">
              ¿Ya transferiste al Alias o tenés una Clave de Licencia?
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              Ingresá el número de comprobante de Mercado Pago o tu código de
              activación para habilitar la licencia permanente en tu cuenta.
            </p>
          </div>

          <form
            onSubmit={handleConfirmPaymentOrLicense}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <input
              type="text"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="Ej: MP-849201 o LIC-PASTOPRO-2026"
              className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-white border border-zinc-200 rounded-xl"
            />
            <button
              type="submit"
              data-testid="activate-subscription-btn"
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors text-center break-words cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Activar Licencia Definitiva</span>
            </button>
          </form>
        </div>

        {/* Historial de Pagos / Comprobantes */}
        {normalizedSub.paymentHistory &&
          normalizedSub.paymentHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-900">
                Comprobante de Licencia Registrado
              </div>
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {normalizedSub.paymentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-white"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 break-words">
                        {item.planLabel}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 break-all">
                        {item.date} · {item.method} · Ref: {item.referenceCode}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700 tabular-nums shrink-0">
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
