import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Mail, Phone, User, MessageCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from '@/hooks/useTranslation';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  category: z.enum(['general', 'product', 'order', 'technical', 'billing', 'partnership']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  orderNumber: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
  children?: React.ReactNode;
  triggerText?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'link';
  triggerSize?: 'sm' | 'default' | 'lg';
  triggerIcon?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ContactModal({
  children,
  triggerText = "Contact Us",
  triggerVariant = "default",
  triggerSize = "default",
  triggerIcon = <MessageSquare className="h-4 w-4" />,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ContactModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      category: 'general',
      message: '',
      orderNumber: '',
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/contact', data);
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: t('contact.successTitle') || 'Message Sent',
          description: t('contact.successDesc') || 'Thank you for contacting us. We will get back to you within 24 hours.',
        });
        form.reset();
        setIsOpen(false);
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      toast({
        title: t('contact.errorTitle') || 'Error',
        description: t('contact.errorDesc') || 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: 'general', label: t('contact.categories.general') || 'General Inquiry' },
    { value: 'product', label: t('contact.categories.product') || 'Product Information' },
    { value: 'order', label: t('contact.categories.order') || 'Order Support' },
    { value: 'technical', label: t('contact.categories.technical') || 'Technical Support' },
    { value: 'billing', label: t('contact.categories.billing') || 'Billing & Payments' },
    { value: 'partnership', label: t('contact.categories.partnership') || 'Partnership' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {children || (
            <Button variant={triggerVariant} size={triggerSize}>
              {triggerIcon}
              {triggerText}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('contact.title') || 'Contact Us'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t('contact.name') || 'Full Name'}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('contact.namePlaceholder') || 'Enter your full name'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('contact.email') || 'Email Address'}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('contact.emailPlaceholder') || 'Enter your email'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {t('contact.phone') || 'Phone Number'} ({t('contact.optional') || 'optional'})
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t('contact.phonePlaceholder') || 'Enter your phone number'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contact.category') || 'Category'}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contact.categoryPlaceholder') || 'Select a category'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.subject') || 'Subject'}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('contact.subjectPlaceholder') || 'Brief description of your inquiry'} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('category') === 'order' && (
              <FormField
                control={form.control}
                name="orderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contact.orderNumber') || 'Order Number'} ({t('contact.optional') || 'optional'})</FormLabel>
                    <FormControl>
                      <Input placeholder={t('contact.orderNumberPlaceholder') || 'Enter your order number'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.message') || 'Message'}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('contact.messagePlaceholder') || 'Please provide details about your inquiry...'}
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                {t('contact.cancel') || 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (t('contact.sending') || 'Sending...') : (t('contact.send') || 'Send Message')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}