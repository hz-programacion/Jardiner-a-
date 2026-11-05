import jsPDF from 'jspdf';
import {
  BusinessProfileConfig,
  InvoiceRecord,
  JobPhotoItem,
  PaymentProfileConfig,
} from '../types/lawn';
import { extractInvoicePhotoItems } from './lawnLogic';

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

interface LoadedReceiptPhoto {
  item: JobPhotoItem;
  stageLabel: string;
  jpegDataUrl: string;
  imageElement: HTMLImageElement;
}

function loadHtmlImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !url) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timeout = window.setTimeout(() => {
      resolve(null);
    }, 3500);

    img.onload = () => {
      window.clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    img.src = url;
  });
}

async function prepareReceiptPhotos(
  invoice: InvoiceRecord,
  includePhotos: boolean
): Promise<{
  beforeList: LoadedReceiptPhoto[];
  afterList: LoadedReceiptPhoto[];
  allLoaded: LoadedReceiptPhoto[];
}> {
  if (!includePhotos || typeof document === 'undefined') {
    return { beforeList: [], afterList: [], allLoaded: [] };
  }

  const rawItems = extractInvoicePhotoItems(invoice);
  if (rawItems.length === 0) {
    return { beforeList: [], afterList: [], allLoaded: [] };
  }

  const rawBefore = rawItems.filter((p) => p.stage === 'antes').slice(0, 2);
  const rawAfter = rawItems.filter((p) => p.stage === 'despues').slice(0, 2);
  const combined = [...rawBefore, ...rawAfter];

  const loaded: LoadedReceiptPhoto[] = [];
  let beforeIdx = 0;
  let afterIdx = 0;

  for (const item of combined) {
    const img = await loadHtmlImage(item.url);
    if (!img) continue;

    const offscreen = document.createElement('canvas');
    const targetW = 560;
    const targetH = 315;
    offscreen.width = targetW;
    offscreen.height = targetH;
    const octx = offscreen.getContext('2d');
    if (!octx) continue;

    octx.fillStyle = '#0f172a';
    octx.fillRect(0, 0, targetW, targetH);

    // Draw image with cover fit
    const imgW = img.naturalWidth || 480;
    const imgH = img.naturalHeight || 270;
    const scale = Math.max(targetW / imgW, targetH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (targetW - drawW) / 2;
    const offsetY = (targetH - drawH) / 2;
    octx.drawImage(img, offsetX, offsetY, drawW, drawH);

    const isBefore = item.stage === 'antes';
    if (isBefore) beforeIdx += 1;
    else afterIdx += 1;

    const stageLabel = isBefore
      ? `ANTES #${beforeIdx}`
      : `DESPUÉS #${afterIdx}`;

    // Draw top-left stage pill directly into rasterized image for crystal-clear PDF/PNG export
    octx.fillStyle = isBefore ? '#d97706' : '#059669';
    octx.fillRect(14, 14, isBefore ? 116 : 138, 30);
    octx.fillStyle = '#ffffff';
    octx.font = 'bold 14px sans-serif';
    octx.fillText(stageLabel, 24, 34);

    const jpegDataUrl = offscreen.toDataURL('image/jpeg', 0.92);
    loaded.push({
      item,
      stageLabel,
      jpegDataUrl,
      imageElement: img,
    });
  }

  return {
    beforeList: loaded.filter((l) => l.item.stage === 'antes'),
    afterList: loaded.filter((l) => l.item.stage === 'despues'),
    allLoaded: loaded,
  };
}

/**
 * Downloads a high-resolution, vector PDF receipt formatted for WhatsApp, email, or print.
 * Incorporates exact client specs, tasks, cut duration, next visit scheduling, CBU/Alias,
 * and an embedded "Antes y Después" photographic comparison section when available.
 */
export async function downloadReceiptAsPdf(
  invoice: InvoiceRecord,
  paymentProfile?: PaymentProfileConfig,
  businessProfile?: BusinessProfileConfig,
  includePhotos = true
): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const preparedPhotos = await prepareReceiptPhotos(invoice, includePhotos);
    const hasPhotos = preparedPhotos.allLoaded.length > 0;

    const brandTitle = (businessProfile?.appName || 'PastoPro').slice(0, 48);
    const brandSlogan = (
      businessProfile?.slogan || 'Mantenimiento de Césped, Parques y Quintas'
    ).slice(0, 75);
    const ownerPhone = businessProfile?.ownerPhone || '';
    const alias = (paymentProfile?.alias || 'alias.cobro.servicio').trim();
    const cbu = (paymentProfile?.cbu || 'Sin CBU cargado').trim();
    const holder = (
      paymentProfile?.holderName ||
      businessProfile?.ownerName ||
      'Titular del Servicio'
    ).trim();
    const bank = (
      paymentProfile?.bankName || 'Mercado Pago / Transferencia Bancaria'
    ).trim();

    // 1. Top Executive Slate-900 Header Bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 36, 'F');

    // Emerald-600 accent stripe
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 36, 210, 2, 'F');

    // Brand Name & Slogan
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text(brandTitle, 16, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(brandSlogan, 16, 22);
    if (ownerPhone) {
      doc.text(`Contacto / WhatsApp: ${ownerPhone}`, 16, 28);
    }

    // Receipt Number & Status
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(110, 231, 183);
    doc.text(invoice.invoiceNumber, 194, 13, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Fecha: ${invoice.date}`, 194, 19.5, { align: 'right' });

    // Status Badge
    if (invoice.status === 'Pagado') {
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(150, 23, 44, 7.5, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const paidMethod = invoice.paymentMethod
        ? ` (${invoice.paymentMethod})`
        : '';
      doc.text(`PAGADO${paidMethod}`, 172, 28, { align: 'center' });
    } else {
      doc.setFillColor(217, 119, 6);
      doc.roundedRect(144, 23, 50, 7.5, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('PENDIENTE DE COBRO', 169, 28, { align: 'center' });
    }

    // 2. Client & Property Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(16, 43, 178, 42, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('DATOS DEL CLIENTE E INMUEBLE', 22, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    // Left Column
    doc.text('Cliente:', 22, 57);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.clientName.slice(0, 38), 42, 57);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Dirección:', 22, 63.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.address.slice(0, 38), 42, 63.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Localidad:', 22, 70);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text((invoice.neighborhood || 'Zona de Servicio').slice(0, 36), 42, 70);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Teléfono:', 22, 76.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.phone || 'No registrado', 42, 76.5);

    // Right Column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Fecha de Servicio:', 112, 57);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.date, 144, 57);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Propiedad:', 112, 63.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${invoice.propertyType} (${invoice.areaSqm} m²)`, 144, 63.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Próxima Visita:', 112, 70);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text((invoice.nextScheduledDate || 'A coordinar').slice(0, 26), 144, 70);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Comprobante:', 112, 76.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.invoiceNumber, 144, 76.5);

    // 3. Tasks Completed Section
    let currentY = 92;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('TRABAJOS REALIZADOS EN EL LOTE', 16, currentY);

    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(16, currentY, 194, currentY);

    currentY += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    const tasks =
      invoice.tasksCompleted.length > 0
        ? invoice.tasksCompleted
        : ['Corte de césped', 'Bordeado perimetral', 'Limpieza final'];

    for (const task of tasks) {
      doc.setFillColor(16, 185, 129);
      doc.circle(20, currentY - 1, 1, 'F');
      doc.text(task.slice(0, 95), 24, currentY);
      currentY += 5.5;
    }

    currentY += 2;

    // 4. Embedded Before & After Photo Evidence Section (When photos exist)
    if (hasPhotos) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(167, 243, 208);
      doc.setLineWidth(0.5);

      const pairsCount = Math.max(
        preparedPhotos.beforeList.length,
        preparedPhotos.afterList.length,
        1
      );
      const rowHeightMm = pairsCount > 1 ? 43 : 48;
      const boxHeightMm = 12 + pairsCount * rowHeightMm;

      doc.roundedRect(16, currentY, 178, boxHeightMm, 3, 3, 'FD');

      doc.setTextColor(6, 95, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(
        'REGISTRO FOTOGRÁFICO DEL SERVICIO · ANTES Y DESPUÉS DEL JARDÍN',
        21,
        currentY + 6.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${preparedPhotos.beforeList.length} ${
          preparedPhotos.beforeList.length === 1 ? 'foto Antes' : 'fotos Antes'
        } · ${preparedPhotos.afterList.length} ${
          preparedPhotos.afterList.length === 1 ? 'foto Después' : 'fotos Después'
        }`,
        189,
        currentY + 6.5,
        { align: 'right' }
      );

      const imgWidthMm = 81;
      const imgHeightMm = pairsCount > 1 ? 37 : 41;

      for (let rowIdx = 0; rowIdx < pairsCount; rowIdx++) {
        const rowY = currentY + 9.5 + rowIdx * rowHeightMm;
        const leftPhoto = preparedPhotos.beforeList[rowIdx];
        const rightPhoto = preparedPhotos.afterList[rowIdx];

        if (leftPhoto) {
          doc.addImage(
            leftPhoto.jpegDataUrl,
            'JPEG',
            21,
            rowY,
            imgWidthMm,
            imgHeightMm
          );
          doc.setDrawColor(217, 119, 6);
          doc.setLineWidth(0.4);
          doc.rect(21, rowY, imgWidthMm, imgHeightMm, 'S');
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.rect(21, rowY, imgWidthMm, imgHeightMm, 'S');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Sin foto previa en este par',
            21 + imgWidthMm / 2,
            rowY + imgHeightMm / 2,
            { align: 'center' }
          );
        }

        if (rightPhoto) {
          doc.addImage(
            rightPhoto.jpegDataUrl,
            'JPEG',
            108,
            rowY,
            imgWidthMm,
            imgHeightMm
          );
          doc.setDrawColor(5, 150, 105);
          doc.setLineWidth(0.4);
          doc.rect(108, rowY, imgWidthMm, imgHeightMm, 'S');
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.rect(108, rowY, imgWidthMm, imgHeightMm, 'S');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Sin foto posterior en este par',
            108 + imgWidthMm / 2,
            rowY + imgHeightMm / 2,
            { align: 'center' }
          );
        }
      }

      currentY += boxHeightMm + 4;
    }

    // 5. Banking & Payment Alias Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.roundedRect(16, currentY, 178, 34, 3, 3, 'FD');

    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('DATOS PARA TRANSFERENCIA / MERCADO PAGO', 22, currentY + 6.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`ALIAS: ${alias}`, 22, currentY + 14);

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`CBU / CVU: ${cbu}`, 22, currentY + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const cuitPart = paymentProfile?.cuit ? `   |   CUIT: ${paymentProfile.cuit}` : '';
    doc.text(
      `Titular: ${holder}   |   Entidad: ${bank}${cuitPart}`.slice(0, 95),
      22,
      currentY + 28
    );

    currentY += 38;

    // 6. Total Billed Footer Bar
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(16, currentY, 178, 17, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('TOTAL DEL SERVICIO', 24, currentY + 11);

    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(15.5);
    doc.text(
      `$${invoice.amount.toLocaleString('es-AR')} ARS`,
      188,
      currentY + 11.5,
      { align: 'right' }
    );

    // 7. Watermark Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Comprobante digital emitido con PastoPro · Mantenimiento de Césped, Parques y Quintas',
      105,
      288,
      { align: 'center' }
    );

    doc.save(`Comprobante_${invoice.invoiceNumber}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    return false;
  }
}

/**
 * Renders a high-resolution, print-ready receipt image on an HTML5 Canvas
 * (including embedded "Antes y Después" garden photos when available)
 * and downloads it as a PNG file (`Comprobante_REC-2026-XXXX.png`).
 */
export async function downloadReceiptAsPng(
  invoice: InvoiceRecord,
  paymentProfile?: PaymentProfileConfig,
  businessProfile?: BusinessProfileConfig,
  includePhotos = true
): Promise<boolean> {
  try {
    const preparedPhotos = await prepareReceiptPhotos(invoice, includePhotos);
    const hasPhotos = preparedPhotos.allLoaded.length > 0;
    const pairsCount = hasPhotos
      ? Math.max(
          preparedPhotos.beforeList.length,
          preparedPhotos.afterList.length,
          1
        )
      : 0;
    const photoBlockHeight = hasPhotos ? 76 + pairsCount * 224 : 0;

    const canvas = document.createElement('canvas');
    const width = 840;
    const tasksCount = Math.max(1, invoice.tasksCompleted.length);
    const height = 820 + tasksCount * 36 + photoBlockHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const padX = 44;
    const contentWidth = width - padX * 2;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top Executive Slate-900 Header Banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, 132);

    // Emerald-600 accent stripe
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 132, width, 6);

    const brandTitle = (businessProfile?.appName || 'PastoPro').slice(0, 42);
    const brandSlogan = (
      businessProfile?.slogan || 'Mantenimiento de Parques, Quintas y Lotes'
    ).slice(0, 68);
    const ownerContact = businessProfile?.ownerPhone
      ? ` · Tel: ${businessProfile.ownerPhone}`
      : '';

    ctx.fillStyle = '#6EE7B7';
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
    ctx.fillText(brandTitle, padX, 72);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '15px sans-serif';
    ctx.fillText(brandSlogan, padX, 102);

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
    ctx.fillText(`Fecha del servicio: ${invoice.date}`, padX, y);
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
      `Próxima visita: ${invoice.nextScheduledDate || 'Servicio puntual / A coordinar'}`,
      padX,
      y
    );

    // Divider
    y += 22;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();

    // Tasks Header
    y += 32;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Trabajos realizados en el lote:', padX, y);

    y += 28;
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

    // Embedded Before & After Photos Section on PNG Canvas
    if (hasPhotos) {
      y += 10;
      const sectionBoxH = 56 + pairsCount * 214;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(padX, y, contentWidth, sectionBoxH);
      ctx.strokeStyle = '#A7F3D0';
      ctx.lineWidth = 2;
      ctx.strokeRect(padX, y, contentWidth, sectionBoxH);

      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(
        'REGISTRO FOTOGRÁFICO · ANTES Y DESPUÉS DEL JARDÍN',
        padX + 18,
        y + 30
      );

      const cardW = Math.floor((contentWidth - 48) / 2);
      const cardH = 196;

      for (let rowIdx = 0; rowIdx < pairsCount; rowIdx++) {
        const cardY = y + 46 + rowIdx * 214;
        const leftPhoto = preparedPhotos.beforeList[rowIdx];
        const rightPhoto = preparedPhotos.afterList[rowIdx];

        const leftX = padX + 16;
        const rightX = padX + 16 + cardW + 16;

        if (leftPhoto) {
          const loadedImg = await loadHtmlImage(leftPhoto.jpegDataUrl);
          if (loadedImg) {
            ctx.drawImage(loadedImg, leftX, cardY, cardW, cardH);
          }
          ctx.strokeStyle = '#D97706';
          ctx.lineWidth = 2;
          ctx.strokeRect(leftX, cardY, cardW, cardH);
        } else {
          ctx.fillStyle = '#F1F5F9';
          ctx.fillRect(leftX, cardY, cardW, cardH);
          ctx.strokeStyle = '#CBD5E1';
          ctx.strokeRect(leftX, cardY, cardW, cardH);
        }

        if (rightPhoto) {
          const loadedImg = await loadHtmlImage(rightPhoto.jpegDataUrl);
          if (loadedImg) {
            ctx.drawImage(loadedImg, rightX, cardY, cardW, cardH);
          }
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2;
          ctx.strokeRect(rightX, cardY, cardW, cardH);
        } else {
          ctx.fillStyle = '#F1F5F9';
          ctx.fillRect(rightX, cardY, cardW, cardH);
          ctx.strokeStyle = '#CBD5E1';
          ctx.strokeRect(rightX, cardY, cardW, cardH);
        }
      }

      y += sectionBoxH + 14;
    }

    // Payment Box (Alias / CBU / Titular — Multi-line safe box)
    const boxY = y + 12;
    const boxHeight = 136;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(padX, boxY, contentWidth, boxHeight);
    ctx.strokeStyle = '#CBD5E1';
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

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      'DATOS BANCARIOS PARA TRANSFERENCIA / MERCADO PAGO',
      padX + 18,
      boxY + 28
    );

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Alias: ${alias.slice(0, 52)}`, padX + 18, boxY + 58);

    ctx.fillStyle = '#1E293B';
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

    ctx.fillStyle = '#FFFFFF';
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

    return true;
  } catch {
    return false;
  }
}
