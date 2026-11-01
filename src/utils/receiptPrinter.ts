import {
  BusinessProfileConfig,
  InvoiceRecord,
  PaymentProfileConfig,
} from '../types/lawn';

/**
 * Renders a high-resolution, print-ready receipt image on an HTML5 Canvas
 * and downloads it as a PNG file (`Comprobante_REC-2026-XXXX.png`).
 * Works 100% reliably inside sandboxed iframes, mobile phones, and desktop browsers.
 */
export function downloadReceiptAsPng(
  invoice: InvoiceRecord,
  paymentProfile?: PaymentProfileConfig,
  businessProfile?: BusinessProfileConfig
): boolean {
  try {
    const canvas = document.createElement('canvas');
    const width = 800;
    const tasksCount = invoice.tasksCompleted.length;
    const height = 660 + tasksCount * 34;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top Dark Green Header Banner
    ctx.fillStyle = '#0F291E';
    ctx.fillRect(0, 0, width, 115);

    const brandTitle = businessProfile?.appName || 'PastoPro';
    const brandSlogan =
      businessProfile?.slogan || 'Mantenimiento de Parques, Quintas y Lotes';
    const ownerContact = businessProfile?.ownerPhone
      ? ` · Tel: ${businessProfile.ownerPhone}`
      : '';

    ctx.fillStyle = '#A7F3D0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `COMPROBANTE DE SERVICIO · ${invoice.invoiceNumber}${ownerContact}`,
      40,
      38
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${brandTitle} — ${brandSlogan}`, 40, 82);

    // Client & Date Section
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Cliente: ${invoice.clientName}`, 40, 165);

    ctx.fillStyle = '#475569';
    ctx.font = '18px sans-serif';
    ctx.fillText(
      `Dirección: ${invoice.address} (${invoice.propertyType} · ${invoice.areaSqm} m²)`,
      40,
      200
    );
    ctx.fillText(`Fecha de realización: ${invoice.date}`, 40, 232);
    ctx.fillText(
      `Estado del pago: ${invoice.status}${
        invoice.paymentMethod ? ` (${invoice.paymentMethod})` : ''
      }`,
      40,
      264
    );
    ctx.fillText(
      `Próximo corte estimado: ${invoice.nextScheduledDate}`,
      40,
      296
    );

    // Divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 322);
    ctx.lineTo(width - 40, 322);
    ctx.stroke();

    // Tasks Header
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('Trabajos realizados en el lote:', 40, 358);

    ctx.fillStyle = '#334155';
    ctx.font = '17px sans-serif';
    let yCursor = 392;
    for (const task of invoice.tasksCompleted) {
      ctx.fillText(`✓  ${task}`, 48, yCursor);
      yCursor += 32;
    }

    // Payment Box (Alias / CBU)
    const boxY = yCursor + 18;
    ctx.fillStyle = '#ECFDF5';
    ctx.fillRect(40, boxY, width - 80, 96);
    ctx.strokeStyle = '#A7F3D0';
    ctx.strokeRect(40, boxY, width - 80, 96);

    const alias = paymentProfile?.alias || 'pastopro.venado';
    const holder = paymentProfile?.holderName || 'Diego Hernández';
    const bank = paymentProfile?.bankName || 'Banco Santa Fe / MercadoPago';

    ctx.fillStyle = '#064E3B';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(
      `Datos para Transferencia / MercadoPago — Alias: ${alias}`,
      58,
      boxY + 36
    );
    ctx.fillStyle = '#047857';
    ctx.font = '15px monospace';
    ctx.fillText(
      `Titular: ${holder} · ${bank}${
        paymentProfile?.cbu ? ` · CBU: ${paymentProfile.cbu}` : ''
      }`,
      58,
      boxY + 68
    );

    // Total Amount Footer Bar
    const totalY = boxY + 125;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(40, totalY, width - 80, 78);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(40, totalY, width - 80, 78);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('TOTAL DEL SERVICIO', 60, totalY + 47);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 32px monospace';
    const amountStr = `$${invoice.amount.toLocaleString('es-AR')}`;
    const textWidth = ctx.measureText(amountStr).width;
    ctx.fillText(amountStr, width - 60 - textWidth, totalY + 49);

    // Trigger PNG download
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Comprobante_${invoice.invoiceNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Also attempt browser print safely for desktop printers (with @media print CSS)
    try {
      window.print();
    } catch {
      // Ignored in sandboxed iframes where PNG download already succeeded
    }

    return true;
  } catch {
    return false;
  }
}
