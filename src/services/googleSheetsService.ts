import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../firebase';
import {
  ClientProperty,
  InvoiceRecord,
  OperationalExpense,
} from '../types/lawn';
import { calculateFinancialSummary } from '../utils/lawnLogic';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
// In-memory access token cache (never stored in localStorage/sessionStorage per security rules)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    provider.setCustomParameters({ prompt: 'consent' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso para Google Sheets.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface SyncSheetPayload {
  properties: ClientProperty[];
  invoices: InvoiceRecord[];
  expenses: OperationalExpense[];
}

const REQUIRED_TABS = [
  'Resumen_Caja',
  'Clientes_y_Lotes',
  'Historial_Cobros',
  'Gastos_Operativos',
];

/**
 * Creates a new Google Spreadsheet with the 4 operational tabs for PastoPro.
 */
export async function createPastoProSpreadsheet(
  accessToken: string,
  title = 'PastoPro — Control Venado Tuerto y Zona'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'es_AR',
      },
      sheets: REQUIRED_TABS.map((tabName, index) => ({
        properties: {
          title: tabName,
          index,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      })),
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        `Error al crear la planilla en Google Sheets (HTTP ${res.status})`
    );
  }

  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * Ensures the required tabs exist in an existing spreadsheet (without hardcoding Sheet1),
 * then writes all current clients, historical cuts/invoices, expenses, and financial summary.
 */
export async function syncAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  payload: SyncSheetPayload
): Promise<{ updatedCells: number; spreadsheetUrl: string }> {
  // 1. Fetch spreadsheet metadata to inspect existing sheet tabs
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const errData = await metaRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        `No se pudo acceder a la planilla (HTTP ${metaRes.status}). Verifica el ID o permisos.`
    );
  }

  const meta = await metaRes.json();
  const existingTitles = new Set<string>(
    (meta.sheets || []).map(
      (s: { properties?: { title?: string } }) => s.properties?.title || ''
    )
  );

  const missingTabs = REQUIRED_TABS.filter((t) => !existingTitles.has(t));
  if (missingTabs.length > 0) {
    const batchAddRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((tabName) => ({
            addSheet: {
              properties: {
                title: tabName,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          })),
        }),
      }
    );

    if (!batchAddRes.ok) {
      const errData = await batchAddRes.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || 'Error preparando pestañas en Google Sheets'
      );
    }
  }

  // 2. Clear existing values in the 4 tabs so deleted rows don't linger
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: REQUIRED_TABS.map((t) => `${t}!A1:Z1000`),
      }),
    }
  );

  // 3. Build data matrices for each tab
  const summary = calculateFinancialSummary(payload.invoices, payload.expenses);
  const nowStr = new Date().toLocaleString('es-AR');

  const resumenRows: (string | number)[][] = [
    ['CONCEPTO', 'VALOR ($ / DATO)', 'DETALLE OPERATIVO'],
    ['Última Sincronización Automática', nowStr, 'Base: Venado Tuerto y Zona'],
    ['Total Facturado Histórico ($)', summary.totalFacturado, `${payload.invoices.length} servicios registrados`],
    ['Total Cobrado en Caja ($)', summary.totalCobrado, 'Pagos ingresados (Efectivo / Transferencia / MP)'],
    ['Total Pendiente por Cobrar ($)', summary.porCobrar, 'Saldos de clientes pendientes'],
    ['Total Gastos Operativos ($)', summary.totalGastos, `${payload.expenses.length} gastos de nafta, tanza y mantenimiento`],
    ['Ganancia Neta de Bolsillo ($)', summary.gananciaNeta, `Margen libre: ${summary.margenPorcentaje}%`],
    ['Total Clientes Activos', payload.properties.length, 'Casas, quintas y terrenos en cartera'],
  ];

  const clientesRows: (string | number)[][] = [
    [
      'ID Cliente',
      'Cliente / Familia',
      'Teléfono / WhatsApp',
      'Dirección',
      'Localidad / Barrio',
      'Tipo Propiedad',
      'Superficie (m²)',
      'Estado Pasto',
      'Frecuencia',
      'Tarifa Actual ($)',
      'Último Cobro ($)',
      'Fecha Último Corte',
      'Próximo Corte',
      'Saldo Pendiente ($)',
      'Notas de Acceso',
    ],
    ...payload.properties.map((p) => {
      const clientInvoices = payload.invoices
        .filter((i) => i.propertyId === p.id || i.clientName === p.clientName)
        .sort((a, b) => b.date.localeCompare(a.date));
      const lastAmount = clientInvoices[0]?.amount ?? p.basePrice;
      const pendingDebt = clientInvoices
        .filter((i) => i.status === 'Pendiente')
        .reduce((acc, i) => acc + i.amount, 0);

      return [
        p.id,
        p.clientName,
        p.phone,
        p.address,
        p.neighborhood,
        p.propertyType,
        p.areaSqm,
        p.grassCondition || 'Regular',
        p.frequency,
        p.basePrice,
        lastAmount,
        p.lastCutDate,
        p.nextCutDate,
        pendingDebt,
        p.accessNotes,
      ];
    }),
  ];

  const cobrosRows: (string | number)[][] = [
    [
      'Nro Recibo',
      'Fecha Corte',
      'Cliente',
      'Dirección',
      'Localidad / Barrio',
      'Tipo Lote',
      'Superficie (m²)',
      'Monto Cobrado ($)',
      'Estado de Pago',
      'Medio de Pago',
      'Tareas Realizadas',
      'Próxima Visita',
    ],
    ...payload.invoices.map((inv) => {
      const prop = payload.properties.find((p) => p.id === inv.propertyId);
      return [
        inv.invoiceNumber,
        inv.date,
        inv.clientName,
        inv.address,
        prop?.neighborhood || inv.neighborhood || 'Venado Tuerto',
        inv.propertyType,
        inv.areaSqm,
        inv.amount,
        inv.status,
        inv.paymentMethod || 'Pendiente',
        inv.tasksCompleted.join(' · '),
        inv.nextScheduledDate,
      ];
    }),
  ];

  const gastosRows: (string | number)[][] = [
    ['ID Gasto', 'Fecha', 'Categoría / Rubro', 'Descripción', 'Monto ($)'],
    ...payload.expenses.map((exp) => [
      exp.id,
      exp.date,
      exp.category,
      exp.description,
      exp.amount,
    ]),
  ];

  // 4. Write all 4 tabs in a single batchUpdate
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Resumen_Caja!A1', values: resumenRows },
          { range: 'Clientes_y_Lotes!A1', values: clientesRows },
          { range: 'Historial_Cobros!A1', values: cobrosRows },
          { range: 'Gastos_Operativos!A1', values: gastosRows },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        `Error al actualizar celdas en Google Sheets (HTTP ${updateRes.status})`
    );
  }

  const updateData = await updateRes.json();
  return {
    updatedCells: updateData.totalUpdatedCells || 0,
    spreadsheetUrl:
      meta.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}
