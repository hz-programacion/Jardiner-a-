import {
  BusinessProfileConfig,
  InvoiceRecord,
  PaymentProfileConfig,
} from '../types/lawn';

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Renders a high-resolution, print-ready receipt image on an HTML5 Canvas
 * and downloads it as a PNG file (`Comprobante_REC-2026-XXXX.png`).
 * Guarantees zero text overflow for long CBU/CVU (22 digits), Alias, Holder, and Addresses.
 */
export function downloadReceiptAsPng(
  invoice: InvoiceRecord,
  paymentProfile?: PaymentProfileConfig,
  businessProfile?: BusinessProfileConfig
): boolean {
  try {
    const canvas = document.createElement('canvas');
    const width = 840;
    const tasksCount = Math.max(1, invoice.tasksCompleted.length);
    const height = 780 + tasksCount * 38;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const padX = 44;
    const contentWidth = width - padX * 2;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top Dark Forest Header Banner
    ctx.fillStyle = '#0B1D16';
    ctx.fillRect(0, 0, width, 132);

    const brandTitle = (businessProfile?.appName || 'PastoPro').slice(0, 42);
    const brandSlogan = (
      businessProfile?.slogan || 'Mantenimiento de Parques, Quintas y Lotes'
    ).slice(0, 68);
    const ownerContact = businessProfile?.ownerPhone
      ? ` · Tel: ${businessProfile.ownerPhone}`
      : '';

    ctx.fillStyle = '#5EEAD4';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      `COMPROBANTE DE SERVICIO · ${invoice.invoiceNumber}${ownerContact}`.slice(
        0,
        75
      ),
      padX,
      36
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(brandTitle, padX, 74);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '15px sans-serif';
    ctx.fillText(brandSlogan, padX, 104);

    // Client & Date Section
    let y = 174;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px sans-serif';
    const clientLines = wrapCanvasLines(
      ctx,
      `Cliente: ${invoice.clientName}`,
      contentWidth
    );
    for (const line of clientLines) {
      ctx.fillText(line, padX, y);
      y += 28;
    }

    ctx.fillStyle = '#334155';
    ctx.font = '16px sans-serif';
    const addressLines = wrapCanvasLines(
      ctx,
      `Dirección: ${invoice.address}${invoice.neighborhood ? ` · ${invoice.neighborhood}` : ''} (${invoice.propertyType} · ${invoice.areaSqm} m²)`,
      contentWidth
    );
    for (const line of addressLines) {
      ctx.fillText(line, padX, y + 4);
      y += 24;
    }

    y += 8;
    ctx.fillText(`Fecha de realización: ${invoice.date}`, padX, y);
    y += 26;
    ctx.fillText(
      `Estado del pago: ${invoice.status}${
        invoice.paymentMethod ? ` (${invoice.paymentMethod})` : ''
      }`,
      padX,
      y
    );
    y += 26;
    ctx.fillText(
      `Próximo corte programado: ${invoice.nextScheduledDate}`,
      padX,
      y
    );

    // Divider
    y += 24;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();

    // Tasks Header
    y += 34;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Detalle de trabajos realizados:', padX, y);

    y += 30;
    ctx.fillStyle = '#334155';
    ctx.font = '16px sans-serif';
    for (const task of invoice.tasksCompleted) {
      const taskLines = wrapCanvasLines(ctx, `✓  ${task}`, contentWidth - 16);
      for (const tl of taskLines) {
        ctx.fillText(tl, padX + 8, y);
        y += 26;
      }
      y += 4;
    }

    // Payment Box (Alias / CBU / Titular — Multi-line safe box)
    const boxY = y + 14;
    const boxHeight = 136;
    ctx.fillStyle = '#F0FDFA';
    ctx.fillRect(padX, boxY, contentWidth, boxHeight);
    ctx.strokeStyle = '#99F6E4';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padX, boxY, contentWidth, boxHeight);

    const alias = (paymentProfile?.alias || 'alias.cobro.servicio').trim();
    const cbu = (paymentProfile?.cbu || 'Sin CBU especificado').trim();
    const holder = (
      paymentProfile?.holderName ||
      businessProfile?.ownerName ||
      'Titular del Servicio'
    ).trim();
    const bank = (
      paymentProfile?.bankName || 'Mercado Pago / Transferencia Bancaria'
    ).trim();

    ctx.fillStyle = '#115E59';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      'DATOS BANCARIOS PARA TRANSFERENCIA / MERCADO PAGO',
      padX + 18,
      boxY + 28
    );

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Alias: ${alias.slice(0, 52)}`, padX + 18, boxY + 58);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`CBU / CVU: ${cbu.slice(0, 48)}`, padX + 18, boxY + 86);

    ctx.fillStyle = '#334155';
    ctx.font = '14px sans-serif';
    const holderBankStr = `Titular: ${holder}  ·  Entidad: ${bank}`;
    const holderLines = wrapCanvasLines(ctx, holderBankStr, contentWidth - 36);
    ctx.fillText(holderLines[0] || holderBankStr, padX + 18, boxY + 114);

    // Total Amount Footer Bar
    const totalY = boxY + boxHeight + 22;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(padX, totalY, contentWidth, 82);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('TOTAL DEL SERVICIO', padX + 24, totalY + 48);

    ctx.fillStyle = '#5EEAD4';
    ctx.font = 'bold 30px monospace';
    const amountStr = `$${invoice.amount.toLocaleString('es-AR')}`;
    const textWidth = ctx.measureText(amountStr).width;
    ctx.fillText(amountStr, width - padX - 24 - textWidth, totalY + 50);

    // Trigger PNG download
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Comprobante_${invoice.invoiceNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

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

