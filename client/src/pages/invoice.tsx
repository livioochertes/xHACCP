import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getMarketFromHostname } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, ExternalLink, QrCode } from "lucide-react";
import QRCode from "qrcode";

export default function Invoice() {
  const [, navigate] = useLocation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  
  // Extract invoice number from URL
  const currentPath = window.location.pathname;
  const invoiceNumber = currentPath.split('/invoice/')[1];

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['/api/invoices/number', invoiceNumber],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/number/${invoiceNumber}`, {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!response.ok) {
        throw new Error('Invoice not found');
      }
      return response.json();
    },
    enabled: !!invoiceNumber,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch company settings for dynamic invoice display
  const { data: companySettings } = useQuery({
    queryKey: ['/admin/api/company-settings'],
    queryFn: async () => {
      const response = await fetch('/admin/api/company-settings', {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!response.ok) {
        throw new Error('Company settings not found');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Generate QR code for payment link
  useEffect(() => {
    if (invoice?.paymentLink) {
      QRCode.toDataURL(invoice.paymentLink, {
        width: 150,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then(setQrCodeDataUrl);
    }
  }, [invoice?.paymentLink]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invoice Not Found</h1>
            <p className="text-gray-600 mb-6">The requested invoice could not be found.</p>
            <Button onClick={() => navigate('/account#invoices')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button onClick={() => navigate('/account#invoices')} variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Account
          </Button>
        </div>

        <Card className="bg-white shadow-lg">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <img 
                  src="/attached_assets/logo_xHACCP-S1_1772812623761.png" 
                  alt="xHACCP" 
                  className="h-12 mb-4"
                />
                <div className="space-y-1">
                  <p className="font-medium">{companySettings?.name || 'Namarte CCL SRL'}</p>
                  <p className="text-sm text-gray-600">{companySettings?.address || 'Calea Mosilor 158'}</p>
                  <p className="text-sm text-gray-600">{companySettings?.zipCode || '020883'} {companySettings?.city || 'Bucharest'}, {companySettings?.country || 'Romania'}</p>
                  {companySettings?.vatNumber && (
                    <p className="text-sm text-gray-600">VAT: {companySettings.vatNumber}</p>
                  )}
                  {companySettings?.registrationNumber && (
                    <p className="text-sm text-gray-600">Reg. No.: {companySettings.registrationNumber}</p>
                  )}
                  <p className="text-sm text-gray-600">{companySettings?.email || 'info@xhaccp.com'}</p>
                  {companySettings?.phone && (
                    <p className="text-sm text-gray-600">{companySettings.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
                <p className="text-lg font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-gray-600">
                  Date: {invoice.issueDate ? format(new Date(invoice.issueDate), "dd/MM/yyyy") : '-'}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Bill To:</h3>
                <div className="space-y-1">
                  <p className="font-medium">{invoice.user?.firstName} {invoice.user?.lastName}</p>
                  {invoice.user?.companyName && (
                    <p className="text-gray-600">{invoice.user.companyName}</p>
                  )}
                  <p className="text-gray-600">{invoice.user?.email}</p>
                  {invoice.user?.companyAddress && (
                    <>
                      <p className="text-gray-600">{invoice.user.companyAddress}</p>
                      <p className="text-gray-600">
                        {invoice.user.companyCity}, {invoice.user.companyZip}
                      </p>
                      <p className="text-gray-600">{invoice.user.companyCountry}</p>
                    </>
                  )}
                  {invoice.user?.vatNumber && (
                    <p className="text-sm text-gray-500">VAT: {invoice.user.vatNumber}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Invoice Details:</h3>
                <div className="space-y-1">
                  <p><span className="text-gray-600">Order ID:</span> #{invoice.orderId}</p>
                  <p><span className="text-gray-600">Supply Date:</span> {(invoice.supplyDate || invoice.issueDate) ? format(new Date(invoice.supplyDate || invoice.issueDate), "dd/MM/yyyy") : '-'}</p>
                  <p><span className="text-gray-600">Payment Method:</span> 
                    <Badge variant="outline" className="ml-2">
                      {invoice.paymentMethod === 'wire_transfer' ? 'Wire Transfer' : invoice.paymentMethod}
                    </Badge>
                  </p>
                  <p><span className="text-gray-600">Currency:</span> {invoice.currency}</p>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Invoice Items */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Items:</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Description</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900">Code</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900">Qty</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Unit Price</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900">VAT%</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-600 font-mono">
                          {item.productCode || '-'}
                        </td>
                        <td className="text-center py-3 px-4">{item.quantity}</td>
                        <td className="text-right py-3 px-4">{parseFloat(item.unitPrice).toFixed(2)} lei</td>
                        <td className="text-center py-3 px-4">{parseFloat(item.vatRate).toFixed(0)}%</td>
                        <td className="text-right py-3 px-4 font-medium">{parseFloat(item.lineTotal).toFixed(2)} lei</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{parseFloat(invoice.subtotal).toFixed(2)} lei</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">TVA ({parseFloat(invoice.vatAmount) === 0 ? '0' : '21'}%):</span>
                  <span className="font-medium">{parseFloat(invoice.vatAmount).toFixed(2)} lei</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2 text-lg font-bold">
                  <span>Total:</span>
                  <span>{parseFloat(invoice.totalAmount).toFixed(2)} lei</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            {invoice.paymentMethod === 'wire_transfer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 p-6 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Payment Information:</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Bank:</strong> {companySettings?.bankName || 'BCR (Romanian Commercial Bank)'}</p>
                    <p><strong>Account Name:</strong> {companySettings?.name || 'NAMARTE CCL SRL'}</p>
                    <p><strong>IBAN:</strong> {companySettings?.iban || 'RO89RNCB0082004530040001'}</p>
                    <p><strong>SWIFT/BIC:</strong> RNCBROBU</p>
                    <p><strong>Reference:</strong> {invoice.invoiceNumber}</p>
                  </div>
                  {invoice.paymentLink && (
                    <div className="mt-4">
                      <Button 
                        onClick={() => window.open(invoice.paymentLink, '_blank')}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Payment Link
                      </Button>
                    </div>
                  )}
                </div>
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center">
                    <h4 className="font-medium text-gray-900 mb-3">Payment QR Code:</h4>
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Payment QR Code" 
                      className="border rounded-lg p-2 bg-white"
                    />
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Scan to access payment information
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Notes:</h4>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
              <p>Thank you for your business!</p>
              <p className="mt-2">
                For questions about this invoice, please contact us at {companySettings?.email || 'info@xhaccp.com'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}