import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(__dirname, '..', 'uploads', 'invoices');

if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

export interface PdfInvoiceData {
  invoiceNumber: string;
  documentType?: string; // e.g. 'FACTURE / INVOICE' or 'DEVIS / PRO-FORMA'
  issueDate: Date;
  dueDate?: Date;
  market: string;
  currency: string;

  seller: {
    name: string;
    address?: string;
    city?: string;
    zipCode?: string;
    country?: string;
    vatNumber?: string;
    registrationNumber?: string;
    email?: string;
    phone?: string;
    iban?: string;
    bankName?: string;
  };

  buyer: {
    name: string;
    companyName?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    country?: string;
    vatNumber?: string;
    registrationNumber?: string;
    email?: string;
  };

  items: {
    productName: string;
    productCode?: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
  }[];

  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string;
  paymentMethod?: string;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function generateInvoicePdf(data: PdfInvoiceData): Promise<string> {
  const filename = `invoice_${data.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
  const filepath = path.join(PDF_DIR, filename);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      const primaryColor = '#1a4f8a';
      const lightGray = '#f5f5f5';
      const darkGray = '#333333';
      const mediumGray = '#666666';

      // Header bar
      doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);

      // Company name in header
      doc.fillColor('white')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(data.seller.name || 'xHACCP', 50, 20, { width: 300 });

      doc.fontSize(10)
        .font('Helvetica')
        .text(data.documentType || 'FACTURE / INVOICE', 50, 50, { width: 300 });

      // Invoice number & date block (top right)
      const invBoxX = 370;
      doc.rect(invBoxX, 10, 180, 60).fill('white');
      doc.fillColor(primaryColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('N° Facture / Invoice #', invBoxX + 8, 16);
      doc.fillColor(darkGray)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(data.invoiceNumber, invBoxX + 8, 30);
      doc.fillColor(mediumGray)
        .fontSize(9)
        .font('Helvetica')
        .text(`Date: ${formatDate(data.issueDate)}`, invBoxX + 8, 48);
      if (data.dueDate) {
        doc.text(`Échéance: ${formatDate(data.dueDate)}`, invBoxX + 8, 58);
      }

      // Seller info block
      doc.fillColor(darkGray).fontSize(10).font('Helvetica-Bold').text('Émetteur / Seller', 50, 100);
      doc.font('Helvetica').fontSize(9).fillColor(darkGray);
      let sellerY = 115;
      doc.text(data.seller.name || '', 50, sellerY); sellerY += 12;
      if (data.seller.address) { doc.text(data.seller.address, 50, sellerY); sellerY += 12; }
      if (data.seller.city || data.seller.zipCode) {
        doc.text(`${data.seller.zipCode || ''} ${data.seller.city || ''}`.trim(), 50, sellerY); sellerY += 12;
      }
      if (data.seller.country) { doc.text(data.seller.country, 50, sellerY); sellerY += 12; }
      if (data.seller.vatNumber) { doc.text(`TVA / VAT: ${data.seller.vatNumber}`, 50, sellerY); sellerY += 12; }
      if (data.seller.registrationNumber) { doc.text(`Reg: ${data.seller.registrationNumber}`, 50, sellerY); sellerY += 12; }
      if (data.seller.email) { doc.text(`Email: ${data.seller.email}`, 50, sellerY); sellerY += 12; }
      if (data.seller.iban) { doc.text(`IBAN: ${data.seller.iban}`, 50, sellerY); sellerY += 12; }

      // Buyer info block
      doc.fillColor(darkGray).fontSize(10).font('Helvetica-Bold').text('Destinataire / Bill To', 320, 100);
      doc.font('Helvetica').fontSize(9).fillColor(darkGray);
      let buyerY = 115;
      const buyerName = data.buyer.companyName || data.buyer.name;
      doc.text(buyerName, 320, buyerY); buyerY += 12;
      if (data.buyer.address) { doc.text(data.buyer.address, 320, buyerY); buyerY += 12; }
      if (data.buyer.city || data.buyer.zipCode) {
        doc.text(`${data.buyer.zipCode || ''} ${data.buyer.city || ''}`.trim(), 320, buyerY); buyerY += 12;
      }
      if (data.buyer.country) { doc.text(data.buyer.country, 320, buyerY); buyerY += 12; }
      if (data.buyer.vatNumber) { doc.text(`TVA / VAT: ${data.buyer.vatNumber}`, 320, buyerY); buyerY += 12; }
      if (data.buyer.email) { doc.text(`Email: ${data.buyer.email}`, 320, buyerY); buyerY += 12; }

      // Table header
      const tableTop = Math.max(sellerY, buyerY) + 25;
      doc.rect(50, tableTop, doc.page.width - 100, 20).fill(primaryColor);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('Description', 55, tableTop + 6, { width: 200 });
      doc.text('Code', 255, tableTop + 6, { width: 60 });
      doc.text('Qté', 315, tableTop + 6, { width: 35, align: 'right' });
      doc.text('P.U. HT', 350, tableTop + 6, { width: 65, align: 'right' });
      doc.text('TVA%', 415, tableTop + 6, { width: 35, align: 'right' });
      doc.text('Total HT', 450, tableTop + 6, { width: 95, align: 'right' });

      // Table rows
      let rowY = tableTop + 20;
      doc.font('Helvetica').fontSize(8.5).fillColor(darkGray);
      data.items.forEach((item, i) => {
        const descriptionHeight = doc.heightOfString(item.productName, { width: 200 });
        const rowHeight = Math.max(18, descriptionHeight + 10);
        if (i % 2 === 0) {
          doc.rect(50, rowY, doc.page.width - 100, rowHeight).fill(lightGray);
        }
        doc.fillColor(darkGray);
        doc.text(item.productName, 55, rowY + 5, { width: 200 });
        doc.text(item.productCode || '', 255, rowY + 5, { width: 60 });
        doc.text(String(item.quantity), 315, rowY + 5, { width: 35, align: 'right' });
        doc.text(formatCurrency(item.unitPrice, data.currency), 350, rowY + 5, { width: 65, align: 'right' });
        doc.text(`${item.vatRate}%`, 415, rowY + 5, { width: 35, align: 'right' });
        doc.text(formatCurrency(item.lineTotal, data.currency), 450, rowY + 5, { width: 95, align: 'right' });
        rowY += rowHeight;
      });

      // Totals block
      const totalsX = 350;
      rowY += 10;
      doc.rect(totalsX, rowY, doc.page.width - totalsX - 50, 0.5).fill('#cccccc');
      rowY += 8;

      doc.fontSize(9).font('Helvetica').fillColor(darkGray);
      doc.text('Sous-total HT / Subtotal:', totalsX, rowY, { width: 100 });
      doc.text(formatCurrency(data.subtotal, data.currency), totalsX + 100, rowY, { width: 95, align: 'right' });
      rowY += 14;

      doc.text(`TVA / VAT:`, totalsX, rowY, { width: 100 });
      doc.text(formatCurrency(data.vatAmount, data.currency), totalsX + 100, rowY, { width: 95, align: 'right' });
      rowY += 8;

      doc.rect(totalsX, rowY, doc.page.width - totalsX - 50, 0.5).fill('#cccccc');
      rowY += 8;

      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('TOTAL:', totalsX, rowY, { width: 100 });
      doc.text(formatCurrency(data.totalAmount, data.currency), totalsX + 100, rowY, { width: 95, align: 'right' });
      rowY += 20;

      // Payment method
      if (data.paymentMethod) {
        doc.fontSize(8.5).font('Helvetica').fillColor(mediumGray);
        const pmLabel = data.paymentMethod === 'card' ? 'Carte bancaire / Card'
          : data.paymentMethod === 'cash_on_delivery' ? 'Paiement à la livraison / Cash on Delivery'
          : 'Virement bancaire / Wire Transfer';
        doc.text(`Mode de paiement / Payment: ${pmLabel}`, 50, rowY);
        rowY += 14;
      }

      // Notes
      if (data.notes) {
        doc.fontSize(8.5).font('Helvetica').fillColor(mediumGray);
        doc.text(`Notes: ${data.notes}`, 50, rowY, { width: doc.page.width - 100 });
        rowY += 14;
      }

      // E-factura stub note for fr market
      if (data.market === 'fr') {
        rowY += 8;
        doc.rect(50, rowY, doc.page.width - 100, 0.5).fill('#cccccc');
        rowY += 8;
        doc.fontSize(7.5).font('Helvetica').fillColor(mediumGray);
        doc.text('Note: Ce document est en cours de dépôt sur Chorus Pro (e-factura FR). / This document is being submitted to Chorus Pro.', 50, rowY, { width: doc.page.width - 100 });
      }

      // Footer
      const footerY = doc.page.height - 50;
      doc.rect(0, footerY, doc.page.width, 50).fill(primaryColor);
      doc.fillColor('white').fontSize(8).font('Helvetica');
      const sellerContact = [data.seller.email, data.seller.phone].filter(Boolean).join(' | ');
      doc.text(sellerContact, 50, footerY + 10, { width: doc.page.width - 100, align: 'center' });
      doc.text(`Document généré par xHACCP · ${data.seller.name}`, 50, footerY + 22, { width: doc.page.width - 100, align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

export async function getInvoicePdfBuffer(filepath: string): Promise<Buffer> {
  return fs.promises.readFile(filepath);
}

export function pdfExists(filepath: string): boolean {
  return fs.existsSync(filepath);
}
