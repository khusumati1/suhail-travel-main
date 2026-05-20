// src/pages/PassengerDetails.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, Calendar, Globe, CreditCard, ChevronLeft, Info, Landmark, Loader2, CheckCircle2, Plane, Clock } from 'lucide-react';
import { Flight, PassengerData } from '../types';
import { bookingService } from '@/services/bookingService';
import { useToast } from '@/hooks/use-toast';

const PassengerDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const flight = location.state?.flight as Flight;

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    nationality: 'Iraq',
    passportNumber: '',
    passportExpiry: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.passportNumber) {
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى إكمال جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const passenger: PassengerData = {
        ...formData,
        type: 'adult',
      };

      const result = await bookingService.createFlightBooking({
        flight,
        passengers: [passenger],
      });

      setBookingRef(result.bookingRef);
      setIsSuccess(true);

      // Navigate to success page after short delay
      setTimeout(() => {
        navigate('/booking-success', { state: { bookingRef: result.bookingRef, flight } });
      }, 1800);

    } catch (error: any) {
      toast({
        title: 'خطأ في الحجز',
        description: error.message || 'تعذر إتمام الحجز حالياً، يرجى المحاولة لاحقاً',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format time from date string
  const formatTime = (dt: string) => {
    if (!dt) return '--:--';
    const parts = dt.trim().split(' ');
    return parts.length > 1 ? parts[1].substring(0, 5) : dt.substring(0, 5);
  };

  if (!flight) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <button onClick={() => navigate('/home')} className="btn-primary">العودة للرئيسية</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40 px-4 h-16 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary/80">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black tracking-tight">بيانات المسافرين</h1>
        <div className="w-10" />
      </header>

      <main className="p-6 max-w-xl mx-auto">
        {/* ── Flight Summary Card ── */}
        <div className="bg-card border border-border/40 rounded-[28px] p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={flight.airlineLogo || `https://images.kiwi.com/airlines/64/${flight.airlineCode}.png`}
              alt={flight.airline}
              className="w-10 h-10 object-contain rounded-xl border border-border/20 p-1 bg-white"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div>
              <p className="text-sm font-black">{flight.airline}</p>
              <p className="text-[10px] font-bold text-muted-foreground">
                {flight.stops === 0 ? 'رحلة مباشرة' : `${flight.stops} توقف`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums">{formatTime(flight.departureTime)}</p>
              <p className="text-xs font-bold text-muted-foreground mt-1">{flight.origin}</p>
            </div>
            <div className="flex-1 flex flex-col items-center px-4">
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                <span>{flight.duration}</span>
              </div>
              <div className="w-full h-px bg-border/50 relative">
                <div className="absolute inset-0 border-t border-dashed border-border/60" />
                <Plane className="w-3 h-3 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-180" />
              </div>
            </div>
            <div className="text-left">
              <p className="text-2xl font-black tabular-nums">{formatTime(flight.arrivalTime)}</p>
              <p className="text-xs font-bold text-muted-foreground mt-1">{flight.destination}</p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-20 flex flex-col items-center text-center space-y-6"
            >
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div>
                <h2 className="text-2xl font-black mb-2">تم الحجز بنجاح!</h2>
                <p className="text-muted-foreground font-bold">رقم الحجز: <span className="text-primary tracking-widest font-black">{bookingRef}</span></p>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                لقد تم إرسال تفاصيل الحجز إلى هاتفك. شكراً لاختيارك تطبيق سهيل.
              </p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                    يرجى إدخال البيانات بدقة كما هي موجودة في جواز السفر. أي خطأ قد يؤدي إلى مشاكل في المطار أو إلغاء الحجز.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirm} className="space-y-6">
                {/* Passenger 1 Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-black">المسافر 1 (بالغ)</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">الاسم الأول</label>
                      <input 
                        required
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="مثال: Ahmed"
                        disabled={isLoading}
                        className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">اسم العائلة</label>
                      <input 
                        required
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="مثال: Ali"
                        disabled={isLoading}
                        className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">تاريخ الميلاد</label>
                    <input 
                      required
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">الجنسية</label>
                    <select 
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none disabled:opacity-50"
                    >
                      <option value="Iraq">العراق (Iraq)</option>
                      <option value="Jordan">الأردن (Jordan)</option>
                      <option value="Lebanon">لبنان (Lebanon)</option>
                      <option value="Turkey">تركيا (Turkey)</option>
                    </select>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border/40">
                    <div className="flex items-center gap-2 mb-4">
                      <Landmark className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-black">بيانات الجواز</h2>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">رقم الجواز</label>
                      <input 
                        required
                        name="passportNumber"
                        value={formData.passportNumber}
                        onChange={handleInputChange}
                        placeholder="A12345678"
                        disabled={isLoading}
                        className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all uppercase disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground mr-1 uppercase">تاريخ انتهاء الجواز</label>
                      <input 
                        required
                        type="date"
                        name="passportExpiry"
                        value={formData.passportExpiry}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="w-full h-14 bg-secondary/30 border border-border/40 rounded-2xl px-4 text-sm font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Bottom Bar */}
      {!isSuccess && (
        <footer className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md border-t border-border/40 p-6 z-50">
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">المبلغ الإجمالي</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">
                  {flight.price.toLocaleString()}
                  <span className="text-sm font-bold mr-2 text-muted-foreground">د.ع</span>
                </p>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">دفع آمن</span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="w-full h-16 bg-primary text-primary-foreground rounded-[24px] text-base font-black tracking-[0.15em] uppercase shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  جاري الحجز...
                </>
              ) : (
                <>
                  تأكيد الحجز الفعلي
                  <ChevronLeft className="w-5 h-5" strokeWidth={3} />
                </>
              )}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default PassengerDetails;
